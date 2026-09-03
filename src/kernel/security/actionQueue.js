// ── kernel/security/actionQueue.js ───────────────────────────────────────
// MOAT Layer 4 — AKTIONS-ISOLATION. Die QUEUE-MECHANIK; die WHITELIST bringt
// die Domäne mit. Das ist die dritte feine Stelle der Naht aus ADR-0018.
//
//   Agent → ActionQueue (SCHREIBT nur) → Worker (liest + VALIDIERT + führt aus)
//
// Zwei Tore:
//   1) enqueueAction: steht der actionType nicht auf der Whitelist, wird schon
//      VOR dem Schreiben abgelehnt.
//   2) Worker: prüft das Payload gegen Schema und Länge, nach N Versuchen FAILED.
//
// So kann selbst ein gekaperter Agent nur Aktionen in die Queue legen, die auf
// der Whitelist stehen und begrenzt sind — an die Außenwelt kommt er nicht direkt.

export function createActionQueue({ whitelist, validators }) {
  const erlaubt = new Set(whitelist);
  const queue = []; // { id, threadId, actionType, payload, status, attempts }
  let _id = 0;
  let timer = null;

  function enqueueAction({ threadId, actionType, payload }) {
    // TOR 1: nicht auf der Whitelist → nicht einmal schreiben.
    if (!erlaubt.has(actionType)) {
      throw new Error(
        `actionType steht nicht auf der Whitelist: ${actionType}`,
      );
    }
    const action = {
      id: ++_id,
      threadId,
      actionType,
      payload,
      status: "PENDING",
      attempts: 0,
    };
    queue.push(action);
    return action.id;
  }

  // Worker: läuft periodisch. Atomar übernehmen → validieren → ausführen → retry/fail.
  async function processOne(action) {
    action.status = "PROCESSING";
    action.attempts++;

    // TOR 2: Payload-Validierung.
    const ok = validators[action.actionType]?.(action.payload);
    if (!ok) {
      action.status = "REJECTED";
      return;
    }

    try {
      // HIER fände der echte externe Aufruf statt (fetch + hartes Timeout).
      // Im Starter nur simuliert.
      // await fetch(...);
      action.status = "DONE";
    } catch {
      if (action.attempts >= 3) action.status = "FAILED";
      else action.status = "PENDING"; // wird erneut versucht
    }
  }

  function startActionWorker(intervalMs = 5000) {
    if (timer) return;
    timer = setInterval(async () => {
      const pending = queue.filter((a) => a.status === "PENDING");
      for (const a of pending) await processOne(a);
    }, intervalMs);
    timer.unref?.();
  }

  function stopActionWorker() {
    clearInterval(timer);
    timer = null;
  }

  // Eine Kopie: von außen ist die Queue nicht manipulierbar.
  function getQueue() {
    return queue.slice();
  }

  return { enqueueAction, getQueue, startActionWorker, stopActionWorker };
}
