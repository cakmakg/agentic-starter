// ── agents/fileSaver.js ──────────────────────────────────────────────────
// Artefakti kalici depoya yazar. LLM YOK (deterministik).
//
// Kritik: fileSaved=true doner → orchestrator FREN2 tetiklenir → HITL.
// Yani "kaydet" eylemi, "insan onayina goturme"yi tetikleyen sinyaldir.
//
// Burada in-memory store kullaniyoruz (starter sifir-altyapi calissin diye).
// Production'da: MongoDB/Postgres'e upsert. Bkz. EXTEND.md.

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
    log: ["💾 fileSaver: artefakt kaydedildi (AWAITING_APPROVAL)"],
  };
}

// Reload sonrasi fallback: SSE event kaybolursa istemci icerigi buradan ceker.
export function getArtifact(threadId) {
  return store.get(threadId) || null;
}
export function markPublished(threadId) {
  const a = store.get(threadId);
  if (a) a.status = "PUBLISHED";
}
