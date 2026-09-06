// ── domains/report/agents/fileSaver.js ───────────────────────────────────
// Schreibt das Artefakt in den dauerhaften Speicher. KEIN LLM (deterministisch).
//
// Entscheidend: liefert fileSaved=true → BREMSE 2 greift → HITL. Die Aktion
// "speichern" ist also das Signal, das "zur menschlichen Genehmigung bringen"
// auslöst.
//
// Der Speicher liegt seit T11 nicht mehr im Arbeitsspeicher, sondern hinter der
// Dauerhaftigkeits-Schicht des Kerns (ADR-0025, ADR-0027). Nach außen ändert das
// NICHTS: dieselben drei Funktionen, dieselben Rückgaben. Die Mechanik gehört in
// den Kern, die Bedeutung — was ein Artefakt dieser Domäne ist — hierher (ADR-0018).

import { createArtifactStore } from "../../../kernel/persistence/store.js";

const store = createArtifactStore("artefakte-report"); // threadId -> { task, content, status }

export function fileSaverNode(state) {
  store.set(state.threadId, {
    task: state.task,
    content: state.draft,
    status: "AWAITING_APPROVAL",
  });
  return {
    fileSaved: true,
    nextAgent: "orchestrator",
    log: ["💾 fileSaver: Artefakt gespeichert (AWAITING_APPROVAL)"],
  };
}

// Fallback nach einem Reload: geht ein SSE-Event verloren, holt sich der Client
// den Inhalt von hier.
export function getArtifact(threadId) {
  return store.get(threadId) || null;
}

export function markPublished(threadId) {
  // patch statt Mutieren des gelesenen Objekts: eine Änderung, die nur im
  // Arbeitsspeicher landete, wäre nach einem Neustart weg — und niemandem
  // fiele es auf, weil derselbe Prozess sie noch sähe.
  store.patch(threadId, { status: "PUBLISHED" });
}
