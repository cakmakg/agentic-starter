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

// ── Abbildung der Ergebnisse (ADR-0031 Teil 5) ─────────────────────────

test("executed → DONE mit result, rejected → REJECTED mit reason — auch nach dem Abspielen", async () => {
  const q = neueQueue("worker-abbildung");
  const executor = async ({ payload }) =>
    payload.text === "geht"
      ? { outcome: "executed", result: { listingId: "L-1" } }
      : { outcome: "rejected", reason: "invalid_arguments" };
  const ok = q.enqueueAction({
    threadId: "t5",
    actionType: "PING",
    payload: { text: "geht" },
  });
  const nein = q.enqueueAction({
    threadId: "t5",
    actionType: "PING",
    payload: { text: "nein" },
  });
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(60);
  q.stopActionWorker();

  // Eine zweite Queue mit demselben Log sieht, was die erste geschrieben hat.
  for (const sicht of [q, neueQueue("worker-abbildung")]) {
    const a = sicht.getQueue().find((x) => x.id === ok);
    const b = sicht.getQueue().find((x) => x.id === nein);
    assert.equal(a.status, "DONE");
    assert.deepEqual(a.result, { listingId: "L-1" });
    assert.equal(b.status, "REJECTED");
    assert.equal(b.reason, "invalid_arguments");
  }
});

test("failed und jede unklare Antwort → FAILED, nie DONE oder REJECTED", async () => {
  const antworten = {
    failed: { outcome: "failed" },
    ohneGrund: { outcome: "rejected" },
    ohneText: { outcome: "rejected", reason: 42 },
    leer: undefined,
    wirft: null, // Signal: der Executor wirft
  };
  const q = neueQueue();
  const executor = async ({ payload }) => {
    if (payload.text === "wirft") throw new Error("kaputt");
    return antworten[payload.text];
  };
  const ids = Object.keys(antworten).map((text) =>
    q.enqueueAction({ threadId: "t6", actionType: "PING", payload: { text } }),
  );
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(80);
  for (const id of ids) assert.equal(status(q, id), "FAILED");
});

test("keine Wiederholung: der Executor läuft genau einmal, auch über weitere Takte", async () => {
  const q = neueQueue();
  const { executor, aufrufe } = aufzeichnend({ outcome: "failed" });
  const id = q.enqueueAction({
    threadId: "t7",
    actionType: "PING",
    payload: { text: "einmal" },
  });
  q.startActionWorker({ executor, intervalMs: 5 });
  await warte(80); // reichlich Takte: mit Wiederholung wären es drei Aufrufe
  assert.equal(status(q, id), "FAILED");
  assert.equal(aufrufe.length, 1);
});
