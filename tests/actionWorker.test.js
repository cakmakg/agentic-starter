// ── tests/actionWorker.test.js ───────────────────────────────────────────
// Die Mechanik des Workers, ohne Domäne: eine Queue mit eigener Whitelist und
// ein Executor, den der Test aufzeichnet (ADR-0031 Teil 5–6). Die Wirkung über
// den Kern prüft der Integrationstest, nicht diese Datei.

import { test, after } from "node:test";
import assert from "node:assert/strict";

import { createActionQueue } from "../src/kernel/security/actionQueue.js";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Eine eigene Queue je Test: kein Test sieht die Aktionen eines anderen.
const stopps = [];
after(() => stopps.forEach((stopp) => stopp()));

function neueQueue(logName) {
  const q = createActionQueue({
    whitelist: ["PING"],
    validators: {
      PING: (p) => typeof p.text === "string" && p.text.length <= 10,
    },
    logName,
  });
  stopps.push(q.stopActionWorker);
  return q;
}

function aufzeichnend(antwort) {
  const aufrufe = [];
  const executor = async (anfrage) => {
    aufrufe.push(anfrage);
    return antwort;
  };
  return { executor, aufrufe };
}

const status = (q, id) => q.getQueue().find((a) => a.id === id).status;

test("ohne Executor startet kein Worker — auch kein Timer", async () => {
  const q = neueQueue();
  assert.throws(() => q.startActionWorker(), /Executor/);
  assert.throws(() => q.startActionWorker({ intervalMs: 5 }), /Executor/);

  // Hätte der gescheiterte Aufruf einen Timer angelegt, ignorierte der
  // nächste Start seinen Executor, und die Aktion bliebe PENDING.
  const { executor } = aufzeichnend({ outcome: "executed", result: {} });
  const id = q.enqueueAction({
    threadId: "t1",
    actionType: "PING",
    payload: { text: "hallo" },
  });
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(60);
  assert.equal(status(q, id), "DONE");
});

test("Tor 2 vor dem Executor: ein ungültiges Payload erreicht ihn nie", async () => {
  const q = neueQueue();
  const { executor, aufrufe } = aufzeichnend({ outcome: "executed", result: {} });
  const id = q.enqueueAction({
    threadId: "t2",
    actionType: "PING",
    payload: { text: "viel zu lang" },
  });
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(60);
  assert.equal(status(q, id), "REJECTED");
  assert.equal(aufrufe.length, 0);
});

test("der Executor bekommt nur actionType und payload", async () => {
  const q = neueQueue();
  const { executor, aufrufe } = aufzeichnend({ outcome: "executed", result: {} });
  q.enqueueAction({
    threadId: "t-intern",
    actionType: "PING",
    payload: { text: "hallo" },
    idempotencyKey: "k-intern",
  });
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(60);
  assert.deepEqual(aufrufe, [{ actionType: "PING", payload: { text: "hallo" } }]);
});
