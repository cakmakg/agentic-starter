// ── tests/fakePortal.test.js ─────────────────────────────────────────────
// Das Scheinportal (ADR-0031 Teil 3, Teil 3a in docs/kern-integration.md):
// ohne den richtigen Schlüssel keine Wirkung und keine Beobachtung; die einzige
// Wirkung ist POST /listings.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { startFakePortal, hashVon } from "../src/adapters/portal/fakePortal.js";
import { anfrage, neuerSchluessel, neuerSocketPfad } from "./helpers/socket.js";

const SCHLUESSEL = neuerSchluessel();
const portal = await startFakePortal({
  socketPath: neuerSocketPfad(),
  credentialHash: hashVon(SCHLUESSEL).toString("hex"),
});
after(() => portal.close());

const mitSchluessel = (s = SCHLUESSEL) => ({
  authorization: `Bearer ${s}`,
  "content-type": "application/json",
});
const inserieren = (body, headers = mitSchluessel()) =>
  anfrage(portal.socketPath, {
    method: "POST",
    pfad: "/listings",
    headers,
    body,
  });
const beobachten = (headers = mitSchluessel()) =>
  anfrage(portal.socketPath, { pfad: "/listings", headers });
const anzahl = async () =>
  JSON.parse((await beobachten()).text).listings.length;

test("ohne, mit falschem und mit verkürztem Schlüssel: 401, keine Wirkung", async () => {
  const vorher = await anzahl();
  const koerper = JSON.stringify({ portal: "immowelt", text: "x" });
  for (const headers of [
    { "content-type": "application/json" },
    mitSchluessel(neuerSchluessel()),
    mitSchluessel(SCHLUESSEL.slice(0, -1)),
    { authorization: SCHLUESSEL }, // ohne "Bearer "
  ]) {
    assert.equal((await inserieren(koerper, headers)).status, 401);
  }
  assert.equal(await anzahl(), vorher);
});

test("die Beobachtung verlangt den Schlüssel ebenso", async () => {
  const r = await beobachten({});
  assert.equal(r.status, 401);
  assert.ok(!r.text.includes("listings"));
});

test("ein gültiges Inserat wird gespeichert und ist beobachtbar", async () => {
  const r = await inserieren(
    JSON.stringify({ portal: "immowelt", text: "Helle 3-Zimmer-Wohnung" }),
  );
  assert.equal(r.status, 200);
  const { listingId } = JSON.parse(r.text);
  assert.ok(Number.isSafeInteger(listingId) && listingId > 0);
  const { listings } = JSON.parse((await beobachten()).text);
  assert.deepEqual(listings.at(-1), {
    listingId,
    portal: "immowelt",
    text: "Helle 3-Zimmer-Wohnung",
  });
});

test("ungültige Körper ergeben 400 und keine Wirkung", async () => {
  const vorher = await anzahl();
  for (const body of [
    "kein json",
    JSON.stringify([]),
    JSON.stringify({ portal: "immowelt" }),
    JSON.stringify({ portal: "immowelt", text: "x", extra: 1 }),
    JSON.stringify({ portal: 1, text: "x" }),
    "x".repeat(33 * 1024),
  ]) {
    assert.equal((await inserieren(body)).status, 400, body.slice(0, 40));
  }
  assert.equal(await anzahl(), vorher);
});

test("andere Pfade und Methoden: 404", async () => {
  for (const [method, pfad] of [
    ["GET", "/"],
    ["DELETE", "/listings"],
    ["POST", "/listings/1"],
  ]) {
    const r = await anfrage(portal.socketPath, {
      method,
      pfad,
      headers: mitSchluessel(),
    });
    assert.equal(r.status, 404, `${method} ${pfad}`);
  }
});

// Befund F2a im Kern (minimal-core/test/outcome-integrity.test.ts): Node meldet
// Fehler beim accept, etwa EMFILE, als "error" des Servers.
test("F2a: nach zwei Serverfehlern antwortet das Portal weiter und meldet nur den Code", async (t) => {
  const stderr = t.mock.method(process.stderr, "write", () => true);
  const fehler = Object.assign(new Error("accept EMFILE"), { code: "EMFILE" });
  // Ohne Listener beendet schon der erste den Prozess, mit einem einmaligen erst der zweite.
  portal.server.emit("error", fehler);
  portal.server.emit("error", fehler);
  stderr.mock.restore();
  assert.deepEqual(
    stderr.mock.calls.map((c) => c.arguments[0]),
    Array(2).fill("scheinportal: Serverfehler EMFILE\n"),
  );
  assert.equal((await beobachten()).status, 200);
});

// ── Der Prozess (bin/fakePortal.js) ──────────────────────────────────────
const BIN = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "bin",
  "fakePortal.js",
);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scheinportal-"));

function starte(env) {
  return new Promise((resolve, reject) => {
    const kind = spawn(process.execPath, [BIN], {
      env: { PATH: process.env.PATH ?? "", ...env },
    });
    let stdout = "";
    let stderr = "";
    kind.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.includes("ready ")) {
        kind.kill();
        resolve({ bereit: true, stdout, stderr });
      }
    });
    kind.stderr.on("data", (d) => (stderr += d));
    kind.on("error", reject);
    kind.on("exit", (code) => resolve({ bereit: false, code, stdout, stderr }));
  });
}

function datei(name, inhalt) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, inhalt);
  return p;
}

test("bin: mit gültiger Konfiguration meldet der Prozess ready", async () => {
  const socket = neuerSocketPfad();
  const r = await starte({
    PORTAL_SOCKET: socket,
    PORTAL_CREDENTIAL_HASH_FILE: datei(
      "gut",
      hashVon(SCHLUESSEL).toString("hex"),
    ),
  });
  assert.ok(r.bereit, r.stderr);
  assert.equal(r.stdout, `ready ${socket}\n`);
});

test("bin: fehlerhafte Konfiguration beendet den Prozess mit festem Text, ohne Inhalt", async () => {
  const geheim = hashVon(SCHLUESSEL).toString("hex");
  for (const [env, text] of [
    [
      { PORTAL_CREDENTIAL_HASH_FILE: datei("a", geheim) },
      "PORTAL_SOCKET muss ein absoluter Socket-Pfad sein",
    ],
    [{ PORTAL_SOCKET: neuerSocketPfad() }, "PORTAL_CREDENTIAL_HASH_FILE fehlt"],
    [
      {
        PORTAL_SOCKET: neuerSocketPfad(),
        PORTAL_CREDENTIAL_HASH_FILE: path.join(tmp, "fehlt"),
      },
      "PORTAL_CREDENTIAL_HASH_FILE ist nicht lesbar",
    ],
    [
      {
        PORTAL_SOCKET: neuerSocketPfad(),
        PORTAL_CREDENTIAL_HASH_FILE: datei("b", `${geheim}\n`),
      },
      "PORTAL_CREDENTIAL_HASH_FILE hat das falsche Format",
    ],
    [
      {
        PORTAL_SOCKET: neuerSocketPfad(),
        PORTAL_CREDENTIAL_HASH_FILE: datei("c", SCHLUESSEL),
      },
      "PORTAL_CREDENTIAL_HASH_FILE hat das falsche Format",
    ],
  ]) {
    const r = await starte(env);
    assert.equal(r.bereit, false);
    assert.equal(r.code, 1);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, `scheinportal: ${text}\n`);
    assert.ok(!r.stderr.includes(SCHLUESSEL) && !r.stderr.includes(geheim));
  }
});
