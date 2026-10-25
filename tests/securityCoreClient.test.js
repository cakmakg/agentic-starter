// ── tests/securityCoreClient.test.js ─────────────────────────────────────
// Der TB-1-Client (Teil 4a in docs/kern-integration.md): genau eine Anfrage je
// Verbindung, Körper genau {action, arguments}, strenge Deutung — nur ein
// wohlgeformtes `rejected` heißt „keine Wirkung", alles andere ist `failed`.
// Der Client wirft nie.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import {
  frageKern,
  kernExecutor,
} from "../src/adapters/security-core/client.js";
import { neuerSocketPfad } from "./helpers/socket.js";

// Ein Stellvertreter für den Kern: zeichnet jede Anfrage auf und antwortet mit
// dem Text aus `antwort` (null = antwortet nie).
const anfragen = [];
let antwort = "";
const kern = http.createServer((req, res) => {
  const teile = [];
  req.on("data", (t) => teile.push(t));
  req.on("end", () => {
    anfragen.push({
      method: req.method,
      url: req.url,
      connection: req.headers.connection,
      body: Buffer.concat(teile).toString("utf8"),
    });
    if (antwort === null) return;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(antwort);
  });
});
const KERN = neuerSocketPfad();
await new Promise((r) => kern.listen(KERN, r));
after(() => {
  kern.closeAllConnections();
  kern.close();
});

const frage = () =>
  frageKern(
    KERN,
    "publish_listing",
    { portal: "immowelt", text: "x" },
    { timeoutMs: 300 },
  );

test("die Anfrage: POST /actions, Körper genau {action, arguments}, eine Verbindung", async () => {
  anfragen.length = 0;
  antwort = '{"outcome":"executed","result":{"listingId":1}}';
  await frage();
  assert.equal(anfragen.length, 1);
  assert.equal(anfragen[0].method, "POST");
  assert.equal(anfragen[0].url, "/actions");
  assert.equal(anfragen[0].connection, "close");
  assert.deepEqual(JSON.parse(anfragen[0].body), {
    action: "publish_listing",
    arguments: { portal: "immowelt", text: "x" },
  });
});

test("wohlgeformte Antworten werden übernommen", async () => {
  antwort = '{"outcome":"executed","result":{"listingId":1}}';
  assert.deepEqual(await frage(), {
    outcome: "executed",
    result: { listingId: 1 },
  });
  antwort = '{"outcome":"rejected","reason":"invalid_arguments"}';
  assert.deepEqual(await frage(), {
    outcome: "rejected",
    reason: "invalid_arguments",
  });
  antwort = '{"outcome":"failed"}';
  assert.deepEqual(await frage(), { outcome: "failed" });
});

test("alles nicht Wohlgeformte ist failed — auch ein fast richtiges rejected", async () => {
  for (const text of [
    '{"outcome":"rejected","reason":"invalid_arguments","extra":1}',
    '{"outcome":"rejected"}',
    '{"outcome":"rejected","reason":42}',
    '{"outcome":"executed","result":[1]}',
    '{"outcome":"executed"}',
    '{"outcome":"ok"}',
    "[]",
    "kein json",
    "",
  ]) {
    antwort = text;
    assert.deepEqual(await frage(), { outcome: "failed" }, text);
  }
});

test("keine Antwort innerhalb der Zeitgrenze: failed", async () => {
  antwort = null;
  assert.deepEqual(await frage(), { outcome: "failed" });
});

test("kein Kern erreichbar: failed, keine Ausnahme", async () => {
  assert.deepEqual(await frageKern(neuerSocketPfad(), "publish_listing", {}), {
    outcome: "failed",
  });
});

test("nicht serialisierbare Argumente: failed, und es geht keine Anfrage hinaus", async () => {
  anfragen.length = 0;
  assert.deepEqual(await frageKern(KERN, "publish_listing", { n: 1n }), {
    outcome: "failed",
  });
  assert.equal(anfragen.length, 0);
});

// ── kernExecutor: der Executor für den Action-Worker (Teil 4c) ──────────

test("kernExecutor: Queue-Typ → Kernname, Payload unverändert als arguments", async () => {
  anfragen.length = 0;
  antwort = '{"outcome":"executed","result":{"listingId":7}}';
  const executor = kernExecutor({
    socketPath: KERN,
    kernNamen: { PUBLISH_LISTING: "publish_listing" },
  });
  const ergebnis = await executor({
    actionType: "PUBLISH_LISTING",
    payload: { portal: "immowelt", text: "x" },
  });
  assert.deepEqual(ergebnis, { outcome: "executed", result: { listingId: 7 } });
  assert.deepEqual(JSON.parse(anfragen[0].body), {
    action: "publish_listing",
    arguments: { portal: "immowelt", text: "x" },
  });
});

test("kernExecutor: ein Typ ohne Kernnamen geht nicht hinaus und ist failed", async () => {
  anfragen.length = 0;
  antwort = '{"outcome":"executed","result":{"listingId":7}}';
  const executor = kernExecutor({
    socketPath: KERN,
    kernNamen: { PUBLISH_LISTING: "publish_listing" },
  });
  for (const actionType of ["DELETE_LISTING", "constructor", "__proto__"]) {
    assert.deepEqual(
      await executor({ actionType, payload: {} }),
      { outcome: "failed" },
      actionType,
    );
  }
  assert.equal(anfragen.length, 0);
});
