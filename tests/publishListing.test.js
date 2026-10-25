// ── tests/publishListing.test.js ─────────────────────────────────────────
// Der Tool Adapter `publish_listing` gegen die Pflichten aus CC-6 (Teil 3b in
// docs/kern-integration.md): ungültige Argumente abgelehnt · genau eine
// Anfrage, nur an /listings · nur `listingId` im Ergebnis · eine kaputte
// Portalantwort ergibt einen Fehler ohne Leck · der Testschlüssel steht nie in
// Fehlern, Ergebnissen, stdout oder stderr.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import {
  BEKANNTE_PORTALE,
  createPublishListingAdapter,
  leseSchluesseldatei,
  parseArguments,
} from "../src/adapters/portal/publishListing.js";
import { startFakePortal, hashVon } from "../src/adapters/portal/fakePortal.js";
import { TARGET_PORTALS } from "../src/domains/immobilien/agents/listingWriter.js";
import { ConfigError } from "../vendor/security-core/minimal-core/src/core/start.ts";
import { anfrage, neuerSchluessel, neuerSocketPfad } from "./helpers/socket.js";

const SCHLUESSEL = neuerSchluessel();
const GUELTIG = { portal: "immowelt", text: "Helle 3-Zimmer-Wohnung" };

// ── Ein Stellvertreter-Portal, das jede Anfrage aufzeichnet ──────────────
// `modus` bestimmt die Antwort; so lässt sich jede kaputte Antwort erzeugen.
const anfragen = [];
let modus = "ok";
const stellvertreter = http.createServer((req, res) => {
  const teile = [];
  req.on("data", (t) => teile.push(t));
  req.on("end", () => {
    anfragen.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: Buffer.concat(teile).toString("utf8"),
    });
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    if (modus === "ok") return json(200, { listingId: 7 });
    if (modus === "mehr-felder")
      return json(200, { listingId: 7, token: SCHLUESSEL, editUrl: "/x" });
    if (modus === "500") return json(500, { error: `kaputt ${SCHLUESSEL}` });
    if (modus === "kein-json") return json(200, `<html>${SCHLUESSEL}</html>`);
    if (modus === "falscher-typ") return json(200, { listingId: "7" });
    if (modus === "null-id") return json(200, { listingId: 0 });
    if (modus === "riesig")
      return json(200, { listingId: 7, pad: "x".repeat(10_000) });
    if (modus === "stumm") return; // antwortet nie
  });
});
const STELLVERTRETER = neuerSocketPfad();
await new Promise((r) => stellvertreter.listen(STELLVERTRETER, r));
after(() => {
  stellvertreter.closeAllConnections();
  stellvertreter.close();
});

const adapter = createPublishListingAdapter({
  socketPath: STELLVERTRETER,
  credential: SCHLUESSEL,
  timeoutMs: 300,
});

// Fängt alles ab, was während `fn` nach stdout/stderr geschrieben wird.
async function mitMitschnitt(fn) {
  const mitschnitt = [];
  const original = [process.stdout.write, process.stderr.write];
  process.stdout.write = (c, ...r) => (
    mitschnitt.push(String(c)),
    original[0].call(process.stdout, c, ...r)
  );
  process.stderr.write = (c, ...r) => (
    mitschnitt.push(String(c)),
    original[1].call(process.stderr, c, ...r)
  );
  try {
    return { wert: await fn(), mitschnitt: mitschnitt.join("") };
  } finally {
    [process.stdout.write, process.stderr.write] = original;
  }
}

function enthaeltSchluessel(fehler) {
  return `${fehler?.message}\n${fehler?.stack}\n${JSON.stringify(fehler)}`.includes(
    SCHLUESSEL,
  );
}

// ── Argumente ────────────────────────────────────────────────────────────
test("parseArguments lehnt jede ungültige Form ab", () => {
  for (const args of [
    null,
    [],
    "text",
    {},
    { portal: "immowelt" },
    { text: "x" },
    { ...GUELTIG, extra: 1 },
    { portal: "ebay", text: "x" },
    { portal: "Immowelt", text: "x" },
    { portal: "immowelt", text: "" },
    { portal: "immowelt", text: "x".repeat(5001) },
    { portal: "immowelt", text: 42 },
    { portal: ["immowelt"], text: "x" },
  ]) {
    assert.equal(
      parseArguments(args),
      undefined,
      JSON.stringify(args)?.slice(0, 60),
    );
  }
});

test("parseArguments nimmt die gültige Form an, Grenzen eingeschlossen", () => {
  assert.deepEqual(parseArguments(GUELTIG), GUELTIG);
  for (const portal of BEKANNTE_PORTALE) {
    assert.deepEqual(parseArguments({ portal, text: "x" }), {
      portal,
      text: "x",
    });
  }
  assert.ok(parseArguments({ portal: "immowelt", text: "x".repeat(5000) }));
});

test("die Portalliste des Adapters ist die der Domäne", () => {
  assert.deepEqual([...BEKANNTE_PORTALE].sort(), [...TARGET_PORTALS].sort());
});

test("execute prüft selbst noch einmal und schickt bei Ungültigem nichts", async () => {
  anfragen.length = 0;
  await assert.rejects(
    adapter.execute({ portal: "ebay", text: "x" }),
    /erneuter Prüfung/,
  );
  assert.equal(anfragen.length, 0);
});

// ── Die eine Wirkung ─────────────────────────────────────────────────────
test("genau eine Anfrage, nur POST /listings, mit Schlüssel, nur {portal, text}", async () => {
  modus = "ok";
  anfragen.length = 0;
  const ergebnis = await adapter.execute(GUELTIG);
  assert.deepEqual(ergebnis, { listingId: 7 });
  assert.equal(anfragen.length, 1);
  assert.equal(anfragen[0].method, "POST");
  assert.equal(anfragen[0].url, "/listings");
  assert.equal(anfragen[0].authorization, `Bearer ${SCHLUESSEL}`);
  assert.deepEqual(JSON.parse(anfragen[0].body), GUELTIG);
});

test("das Ergebnis trägt nur listingId, auch wenn das Portal mehr liefert", async () => {
  modus = "mehr-felder";
  const ergebnis = await adapter.execute(GUELTIG);
  assert.deepEqual(Object.keys(ergebnis), ["listingId"]);
  assert.ok(!JSON.stringify(ergebnis).includes(SCHLUESSEL));
});

// ── Kaputte Antworten ────────────────────────────────────────────────────
for (const [fall, erwartet] of [
  ["500", /Portal hat das Inserat nicht bestätigt/],
  ["kein-json", /unerwartete Portalantwort/],
  ["falscher-typ", /unerwartete Portalantwort/],
  ["null-id", /unerwartete Portalantwort/],
  ["riesig", /unerwartete Portalantwort/],
  ["stumm", /Portal nicht erreichbar/],
]) {
  test(`kaputte Portalantwort (${fall}): fester Fehler, kein Leck`, async () => {
    modus = fall;
    anfragen.length = 0;
    const { wert: fehler, mitschnitt } = await mitMitschnitt(() =>
      adapter.execute(GUELTIG).then(
        () => assert.fail("hätte werfen müssen"),
        (e) => e,
      ),
    );
    assert.match(fehler.message, erwartet);
    assert.equal(anfragen.length, 1, "genau ein Versuch, keine Wiederholung");
    assert.ok(!enthaeltSchluessel(fehler), "Schlüssel im Fehler");
    assert.ok(!mitschnitt.includes(SCHLUESSEL), "Schlüssel in stdout/stderr");
  });
}

test("Portal nicht erreichbar: fester Fehler, kein Leck", async () => {
  const fern = createPublishListingAdapter({
    socketPath: neuerSocketPfad(),
    credential: SCHLUESSEL,
  });
  const { wert: fehler, mitschnitt } = await mitMitschnitt(() =>
    fern.execute(GUELTIG).catch((e) => e),
  );
  assert.match(fehler.message, /Portal nicht erreichbar/);
  assert.ok(!enthaeltSchluessel(fehler));
  assert.ok(!mitschnitt.includes(SCHLUESSEL));
});

// ── Schlüsseldatei ───────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "schluessel-"));
const datei = (name, inhalt) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, inhalt);
  return p;
};

test("leseSchluesseldatei liest genau das Format asp_ + 64 Hex", () => {
  assert.equal(leseSchluesseldatei(datei("gut", SCHLUESSEL)), SCHLUESSEL);
});

test("leseSchluesseldatei: fail-closed mit ConfigError, ohne Inhalt", () => {
  for (const [pfad, text] of [
    [undefined, "PORTAL_CREDENTIAL_FILE fehlt"],
    [path.join(tmp, "fehlt"), "PORTAL_CREDENTIAL_FILE ist nicht lesbar"],
    [
      datei("zeilenende", `${SCHLUESSEL}\n`),
      "PORTAL_CREDENTIAL_FILE hat das falsche Format",
    ],
    [
      datei("praefix", SCHLUESSEL.replace("asp_", "mcc_")),
      "PORTAL_CREDENTIAL_FILE hat das falsche Format",
    ],
    [
      datei("kurz", SCHLUESSEL.slice(0, -1)),
      "PORTAL_CREDENTIAL_FILE hat das falsche Format",
    ],
  ]) {
    assert.throws(
      () => leseSchluesseldatei(pfad),
      (e) =>
        e instanceof ConfigError &&
        e.message === text &&
        !enthaeltSchluessel(e),
    );
  }
});

// ── Gegen das echte Scheinportal ─────────────────────────────────────────
test("Ende zu Ende gegen das Scheinportal: das Inserat ist beobachtbar", async () => {
  const portal = await startFakePortal({
    socketPath: neuerSocketPfad(),
    credentialHash: hashVon(SCHLUESSEL).toString("hex"),
  });
  try {
    const echt = createPublishListingAdapter({
      socketPath: portal.socketPath,
      credential: SCHLUESSEL,
    });
    const { listingId } = await echt.execute(GUELTIG);
    const r = await anfrage(portal.socketPath, {
      pfad: "/listings",
      headers: { authorization: `Bearer ${SCHLUESSEL}` },
    });
    assert.deepEqual(JSON.parse(r.text).listings, [{ listingId, ...GUELTIG }]);

    // Mit einem anderen Schlüssel: keine Wirkung, und der Adapter meldet es.
    const fremd = createPublishListingAdapter({
      socketPath: portal.socketPath,
      credential: neuerSchluessel(),
    });
    await assert.rejects(
      fremd.execute(GUELTIG),
      /Portal hat das Inserat nicht bestätigt/,
    );
    const danach = await anfrage(portal.socketPath, {
      pfad: "/listings",
      headers: { authorization: `Bearer ${SCHLUESSEL}` },
    });
    assert.equal(JSON.parse(danach.text).listings.length, 1);
  } finally {
    await portal.close();
  }
});
