// ── domains/report/actions.js ────────────────────────────────────────────
// Erlaubte Aktionstypen und ihre Payload-Schemata. Das ist BEDEUTUNG: welche
// Wirkung diese Domäne überhaupt in der Welt haben darf. Die Mechanik der
// Queue steht im Kern (ADR-0018).
//
// Doppeltes Tor: die Whitelist verhindert das Schreiben, die Validierer
// verhindern die Ausführung. Ein gekaperter Agent kommt an beiden nicht vorbei.

import { createActionQueue } from "../../kernel/security/actionQueue.js";

export const whitelist = ["NOTIFY", "WEBHOOK", "EMAIL"];

// Je Typ ein Schema und eine Längengrenze.
export const validators = {
  NOTIFY: (p) => typeof p.text === "string" && p.text.length <= 1000,
  WEBHOOK: (p) => typeof p.url === "string" && p.url.startsWith("https://"),
  EMAIL: (p) =>
    typeof p.to === "string" &&
    p.to.includes("@") &&
    (p.body || "").length <= 5000,
};

// Der Veröffentlichungsweg von `report` bleibt simuliert (ADR-0031 Teil 1).
// Deshalb steht der Simulations-Executor ausdrücklich hier, in der Domäne —
// wer den Worker startet, setzt ihn ein. Er antwortet wie der Kern auf eine
// ausgeführte Aktion, ohne etwas zu tun.
export const simulationsExecutor = async () => ({
  outcome: "executed",
  result: {},
});

// Eine Queue je Domäne. Sie ist ein Modul-Singleton, weil der Worker und die
// Beobachtung über /api/queue dieselbe Liste sehen müssen.
export const reportQueue = createActionQueue({
  whitelist,
  validators,
  logName: "aktionen-report",
});

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  reportQueue;
