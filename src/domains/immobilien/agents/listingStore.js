// ── domains/immobilien/agents/listingStore.js ────────────────────────────
// Schreibt die geprüften Inserate in den (vorläufig In-Memory-)Speicher.
// KEIN LLM (deterministisch) — wie fileSaver.js in domains/report.
//
// staged=true → BREMSE2 greift → HITL. Persistenz mit tenantId (ADR-0025,
// T11) ist ein eigener, noch offener Schritt in Phase 5 — siehe EXTEND.md §3.

const store = new Map(); // threadId -> { property, listings, status }

export function listingStoreNode(state) {
  store.set(state.threadId, {
    property: state.property,
    listings: state.listings,
    status: "AWAITING_APPROVAL",
  });
  return {
    staged: true,
    nextAgent: "orchestrator",
    log: ["💾 listingStore: Inserate gespeichert (AWAITING_APPROVAL)"],
  };
}

export function getListingArtifact(threadId) {
  return store.get(threadId) || null;
}

export function markDelivered(threadId) {
  const a = store.get(threadId);
  if (a) a.status = "DELIVERED";
}
