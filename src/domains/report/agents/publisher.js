// ── domains/report/agents/publisher.js ───────────────────────────────────
// Der Veröffentlichungsagent. Aber Achtung — das Kernprinzip des MOAT:
//
//   AGENTEN RUFEN NIEMALS DIREKT EINE EXTERNE API AUF.
//
// Der Publisher SCHREIBT nur in die ActionQueue. Den echten externen Aufruf
// führt ein separater Worker aus — nach eigener Validierung.
//
// Gründerlektion: Ein gekaperter oder halluzinierender Agent kann weder Daten
// abfließen lassen noch spammen — er kann nur Aktionen in die Queue legen, die
// auf einer Whitelist stehen und schemabegrenzt sind.

import { enqueueAction } from "../actions.js";
import { markPublished } from "./fileSaver.js";

export function publisherNode(state) {
  // KEIN direktes fetch — nur in die Queue schreiben.
  enqueueAction({
    threadId: state.threadId,
    actionType: "NOTIFY", // muss auf der Whitelist stehen, sonst lehnt die Queue ab
    payload: { text: `Neuer Bericht fertig: ${state.task}` },
  });
  markPublished(state.threadId);

  return {
    isPublished: true,
    nextAgent: "END",
    log: [
      "📡 publisher: Aktion in die Queue gelegt (der Worker validiert und führt aus)",
    ],
  };
}
