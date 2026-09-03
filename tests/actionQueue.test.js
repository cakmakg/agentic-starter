// ── tests/actionQueue.test.js ────────────────────────────────────────────
// MOAT Layer 4 — Aktions-Isolation. Zwei Tore, beide werden hier geprüft:
//   Tor 1 (enqueueAction): nicht auf der Whitelist → gar nicht erst schreiben.
//   Tor 2 (Worker):        Payload gegen Schema und Länge, sonst REJECTED.
//
// Das ist die Grundlage von Metrik 3.2 (Unauthorized-Action-Rate). Ein gekaperter
// Agent darf höchstens eine erlaubte, begrenzte Aktion einreihen — und selbst die
// führt er nicht selbst aus.

import { test, after } from "node:test";
import assert from "node:assert/strict";

import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../src/domains/report/actions.js";

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const finde = (id) => getQueue().find((a) => a.id === id);

after(() => stopActionWorker());

test("TOR 1: ein Typ außerhalb der Whitelist wird nicht einmal geschrieben", () => {
  const vorher = getQueue().length;
  assert.throws(
    () =>
      enqueueAction({
        threadId: "t1",
        actionType: "DELETE_ALL",
        payload: {},
      }),
    /Whitelist/,
  );
  assert.equal(
    getQueue().length,
    vorher,
    "Die Queue darf nicht gewachsen sein",
  );
});

test("TOR 1: ein erlaubter Typ landet als PENDING in der Queue", () => {
  const id = enqueueAction({
    threadId: "t2",
    actionType: "NOTIFY",
    payload: { text: "hallo" },
  });
  const a = finde(id);
  assert.equal(a.status, "PENDING");
  assert.equal(a.attempts, 0);
  assert.equal(a.actionType, "NOTIFY");
});

test("getQueue liefert eine Kopie — von außen ist die Queue nicht manipulierbar", () => {
  const kopie = getQueue();
  const laenge = getQueue().length;
  kopie.push({ id: 999, status: "DONE" });
  assert.equal(getQueue().length, laenge);
});

test("TOR 2: der Worker führt gültige Payloads aus und lehnt ungültige ab", async () => {
  const gueltig = enqueueAction({
    threadId: "t3",
    actionType: "NOTIFY",
    payload: { text: "kurz" },
  });
  const zuLang = enqueueAction({
    threadId: "t3",
    actionType: "NOTIFY",
    payload: { text: "x".repeat(1001) },
  });
  const unsicher = enqueueAction({
    threadId: "t3",
    actionType: "WEBHOOK",
    payload: { url: "http://kein-tls.example" },
  });
  const keineMail = enqueueAction({
    threadId: "t3",
    actionType: "EMAIL",
    payload: { to: "ohne-at-zeichen", body: "hi" },
  });

  startActionWorker(5);
  await warte(80);

  assert.equal(finde(gueltig).status, "DONE");
  assert.equal(finde(zuLang).status, "REJECTED", "Längengrenze 1000");
  assert.equal(finde(unsicher).status, "REJECTED", "nur https:// erlaubt");
  assert.equal(finde(keineMail).status, "REJECTED", "Adresse ohne @");
});

test("startActionWorker ist idempotent — ein zweiter Aufruf legt keinen zweiten Timer an", async () => {
  startActionWorker(5);
  startActionWorker(5);
  stopActionWorker();
  const id = enqueueAction({
    threadId: "t4",
    actionType: "EMAIL",
    payload: { to: "a@b.de", body: "kurz" },
  });
  await warte(30);
  assert.equal(
    finde(id).status,
    "PENDING",
    "Nach stopActionWorker darf nichts mehr verarbeitet werden",
  );
});
