// ── tests/integration/kernVerbindung.test.js ─────────────────────────────
// Teil 4a: die Verbindung allein — Client → Security Core → publish_listing →
// Scheinportal, in drei echten Prozessen (dieser Test, der Kern, das Portal).
// Queue und Kernel sind nicht beteiligt: geprüft wird nur, ob die Kette trägt
// und ob jedes der drei Ergebnisse bedeutet, was es sagt.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { frageKern } from "../../src/adapters/security-core/client.js";
import { hashVon } from "../../src/adapters/portal/fakePortal.js";
import {
  anfrage,
  neuerSchluessel,
  neuerSocketPfad,
} from "../helpers/socket.js";

const BIN = path.resolve(import.meta.dirname, "..", "..", "src", "bin");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kernverbindung-"));
function datei(name, inhalt) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, inhalt);
  return p;
}

// Startet ein bin-Skript und wartet auf "ready" oder auf das Ende des Prozesses.
function starte(skript, env) {
  return new Promise((resolve, reject) => {
    const kind = spawn(process.execPath, [path.join(BIN, skript)], {
      env: { PATH: process.env.PATH ?? "", ...env },
    });
    let stdout = "";
    let stderr = "";
    kind.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.includes("ready "))
        resolve({ kind, bereit: true, stdout, stderr });
    });
    kind.stderr.on("data", (d) => (stderr += d));
    kind.on("error", reject);
    kind.on("exit", (code) =>
      resolve({ kind, bereit: false, code, stdout, stderr }),
    );
  });
}
function stoppe(kind) {
  return new Promise((r) => {
    // Durch ein Signal beendet, bleibt exitCode null — dann steht signalCode.
    if (kind.exitCode !== null || kind.signalCode !== null) return r();
    kind.once("exit", () => r());
    kind.kill();
  });
}

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
  await stoppe(kern.kind);
  await stoppe(portal.kind);
});

// Was das Portal gespeichert hat — so, wie der Operator es sieht.
async function inserate() {
  const r = await anfrage(PORTAL, {
    pfad: "/listings",
    headers: { authorization: `Bearer ${SCHLUESSEL}` },
  });
  return JSON.parse(r.text).listings;
}

test("Portal und Kern starten", () => {
  assert.ok(portal.bereit, portal.stderr);
  assert.ok(kern.bereit, kern.stderr);
});

test("gültig → executed, und das Inserat steht im Portal", async () => {
  const antwort = await frageKern(KERN, "publish_listing", {
    portal: "immowelt",
    text: "Helle 3-Zimmer-Wohnung",
  });
  assert.deepEqual(antwort, { outcome: "executed", result: { listingId: 1 } });
  assert.deepEqual(await inserate(), [
    { listingId: 1, portal: "immowelt", text: "Helle 3-Zimmer-Wohnung" },
  ]);
});

test("ungültig → rejected, und im Portal entsteht nichts", async () => {
  for (const [action, args, grund] of [
    ["publish_listing", { portal: "ebay", text: "x" }, "invalid_arguments"],
    ["publish_listing", { portal: "immowelt", text: "" }, "invalid_arguments"],
    // Mehrbyte-Text bleibt unter 16 KiB; Steuerzeichen schreibt JSON mit 6 Bytes (ADR-0031 Teil 5).
    [
      "publish_listing",
      { portal: "immowelt", text: "\u0001".repeat(5000) },
      "request_too_large",
    ],
    ["delete_listing", { id: 1 }, "unknown_action"],
  ]) {
    assert.deepEqual(
      await frageKern(KERN, action, args),
      { outcome: "rejected", reason: grund },
      grund,
    );
  }
  assert.equal((await inserate()).length, 1);
});

test("Kern gestoppt → failed, und im Portal entsteht nichts", async () => {
  await stoppe(kern.kind);
  const antwort = await frageKern(KERN, "publish_listing", {
    portal: "immowelt",
    text: "x",
  });
  assert.deepEqual(antwort, { outcome: "failed" });
  assert.equal((await inserate()).length, 1);
});

test("Kern ohne gültige Schlüsseldatei startet nicht und nennt keinen Inhalt", async () => {
  for (const [schluesseldatei, text] of [
    [undefined, "PORTAL_CREDENTIAL_FILE fehlt"],
    [
      datei("mit-zeilenende.key", `${SCHLUESSEL}\n`),
      "PORTAL_CREDENTIAL_FILE hat das falsche Format",
    ],
  ]) {
    const env = { CORE_SOCKET: neuerSocketPfad(), PORTAL_SOCKET: PORTAL };
    if (schluesseldatei) env.PORTAL_CREDENTIAL_FILE = schluesseldatei;
    const r = await starte("securityCore.js", env);
    assert.equal(r.bereit, false);
    assert.equal(r.code, 1);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, `security core: ${text}\n`);
    assert.ok(!r.stderr.includes(SCHLUESSEL));
  }
});
