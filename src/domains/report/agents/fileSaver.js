// ── domains/report/agents/fileSaver.js ───────────────────────────────────
// Schreibt das Artefakt in den dauerhaften Speicher. KEIN LLM (deterministisch).
//
// Entscheidend: liefert fileSaved=true → BREMSE 2 greift → HITL. Die Aktion
// "speichern" ist also das Signal, das "zur menschlichen Genehmigung bringen"
// auslöst.
//
// Hier wird ein In-Memory-Store benutzt, damit der Starter ohne jede Infrastruktur
// läuft. Persistenz kommt in Phase 5, samt `tenantId` (ADR-0025). Siehe EXTEND.md.

const store = new Map(); // threadId -> { task, content, status }

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
  const a = store.get(threadId);
  if (a) a.status = "PUBLISHED";
}
