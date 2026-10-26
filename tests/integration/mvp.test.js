// ── tests/integration/mvp.test.js ────────────────────────────────────────
// Teil 4c: das MVP über die Queue (docs/kern-integration.md §2.1, M2–M4).
// Scheinportal und Security Core laufen als Kindprozesse. M2 läuft über die
// echte Demo als dritten Prozess; M3 und M4 laufen in diesem Prozess als
// Agentenseite — dieselbe Queue der Domäne, derselbe Executor wie in der Demo.
//
// Das ist ein Funktionsnachweis unter einem Benutzer, kein Trennungsnachweis:
// der lokale Lauf zeigt nicht, dass die Agentenseite den Schlüssel nicht lesen
// könnte (ADR-0031 Teil 10; das zeigt Teil 5).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { kernExecutor } from "../../src/adapters/security-core/client.js";
import { hashVon } from "../../src/adapters/portal/fakePortal.js";
import {
  enqueueAction,
  getQueue,
  kernNamen,
  startActionWorker,
  stopActionWorker,
} from "../../src/domains/immobilien/actions.js";
import { TARGET_PORTALS } from "../../src/domains/immobilien/agents/listingWriter.js";
import { laufe, starte, stoppe } from "../helpers/prozesse.js";
import {
  anfrage,
  neuerSchluessel,
  neuerSocketPfad,
} from "../helpers/socket.js";
import { frischerZustand } from "../helpers/zustand.js";

frischerZustand();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mvp-"));
function datei(name, inhalt) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, inhalt);
  return p;
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const SCHLUESSEL = neuerSchluessel();
const PORTAL = neuerSocketPfad();
const KERN = neuerSocketPfad();

const portal = await starte("fakePortal.js", {
  PORTAL_SOCKET: PORTAL,
  PORTAL_CREDENTIAL_HASH_FILE: datei(
    "portal.hash",
    hashVon(SCHLUESSEL).toString("hex"),
  ),
});
const kern = await starte("securityCore.js", {
  CORE_SOCKET: KERN,
  PORTAL_SOCKET: PORTAL,
  PORTAL_CREDENTIAL_FILE: datei("portal.key", SCHLUESSEL),
});
after(async () => {
  stopActionWorker();
  await stoppe(kern.kind);
  await stoppe(portal.kind);
});

// Die Umgebung der Demo: nur, was die Agentenseite kennen darf (ADR-0031 Teil 3).
function demoUmgebung(zusatz = {}) {
  const zustand = fs.mkdtempSync(path.join(tmp, "zustand-"));
  return {
    STATE_DIR: zustand,
    TRACE_DIR: path.join(zustand, "traces"),
    ...zusatz,
  };
}

// Was das Portal gespeichert hat — so, wie der Operator es sieht.
async function inserate() {
  const r = await anfrage(PORTAL, {
    pfad: "/listings",
    headers: { authorization: `Bearer ${SCHLUESSEL}` },
  });
  return JSON.parse(r.text).listings;
}

// Reiht eine Aktion ein und lässt den Worker laufen, bis sie einen Endzustand hat.
async function ausfuehren(threadId, payload) {
  const id = enqueueAction({ threadId, actionType: "PUBLISH_LISTING", payload });
  startActionWorker({
    executor: kernExecutor({ socketPath: KERN, kernNamen }),
    intervalMs: 10,
  });
  const ende = Date.now() + 15_000;
  const finde = () => getQueue().find((a) => a.id === id);
  while (["PENDING", "PROCESSING"].includes(finde().status) && Date.now() < ende)
    await warte(10);
  // Weitere Takte: eine Wiederholung fiele hier auf.
  await warte(100);
  stopActionWorker();
  return finde();
}

test("Portal und Kern starten", () => {
  assert.ok(portal.bereit, portal.stderr);
  assert.ok(kern.bereit, kern.stderr);
});

test("Demo ohne SECURITY_CORE_SOCKET: Exit 1 mit festem Text, vor jedem Lauf", async () => {
  const vorher = (await inserate()).length;
  const r = await laufe("demoImmobilien.js", demoUmgebung());
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr,
    "demo: SECURITY_CORE_SOCKET muss ein absoluter Socket-Pfad sein\n",
  );
  assert.equal((await inserate()).length, vorher);
});

test("M2: die Demo veröffentlicht über den Kern — drei DONE mit listingId, drei Einträge im Portal", async () => {
  const vorher = (await inserate()).length;
  const r = await laufe(
    "demoImmobilien.js",
    demoUmgebung({ SECURITY_CORE_SOCKET: KERN }),
  );
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const zeilen = r.stdout.match(/^ {3}\S+: DONE · listingId \d+$/gm) ?? [];
  assert.equal(zeilen.length, 3, r.stdout);

  const neu = (await inserate()).slice(vorher);
  assert.deepEqual(neu.map((e) => e.portal).sort(), [...TARGET_PORTALS].sort());
  for (const e of neu) assert.ok(e.text.length > 0);
});

test("M3: ungültige Argumente → REJECTED, kein Eintrag im Portal", async () => {
  const vorher = (await inserate()).length;
  for (const [payload, grund] of [
    // Tor 2 lässt es durch, der Kern lehnt ab.
    [{ portal: "ebay", text: "Wohnung" }, "invalid_arguments"],
    // Steuerzeichen schreibt JSON mit 6 Bytes: Tor 2 lässt 5000 Einheiten
    // durch, der Kern lehnt die Anfrage über 16 KiB ab (ADR-0031 Teil 5).
    [{ portal: "immowelt", text: "\u0001".repeat(5000) }, "request_too_large"],
    // Tor 2 lehnt selbst ab; der Kern wird nicht gefragt.
    [{ portal: "immowelt", text: "" }, undefined],
  ]) {
    const a = await ausfuehren("mvp-m3", payload);
    assert.equal(a.status, "REJECTED", JSON.stringify(payload).slice(0, 60));
    assert.equal(a.reason, grund);
  }
  assert.equal((await inserate()).length, vorher);
});

test("M4: Kern gestoppt → FAILED, keine Wiederholung, kein Eintrag im Portal", async () => {
  await stoppe(kern.kind);
  const vorher = (await inserate()).length;
  const a = await ausfuehren("mvp-m4", {
    portal: "immoscout24",
    text: "Der Kern ist aus",
  });
  assert.equal(a.status, "FAILED");
  assert.equal(a.attempts, 1);
  assert.equal((await inserate()).length, vorher);
});

test("M4: die Demo mit gestopptem Kern — drei FAILED, Exit 1, kein Eintrag im Portal", async () => {
  await stoppe(kern.kind); // schon gestoppt, wenn der Test oben lief
  const vorher = (await inserate()).length;
  const r = await laufe(
    "demoImmobilien.js",
    demoUmgebung({ SECURITY_CORE_SOCKET: KERN }),
  );
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const zeilen = r.stdout.match(/^ {3}\S+: FAILED$/gm) ?? [];
  assert.equal(zeilen.length, 3, r.stdout);
  assert.equal((await inserate()).length, vorher);
});
