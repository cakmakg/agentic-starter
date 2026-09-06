// ── domains/immobilien/agents/listingStore.js ────────────────────────────
// Schreibt die geprüften Inserate in den dauerhaften Speicher. KEIN LLM
// (deterministisch) — wie fileSaver.js in domains/report.
//
// staged=true → BREMSE2 greift → HITL. Die Persistenz mit tenantId (ADR-0025,
// T11) liegt seit Phase 5 hinter der Dauerhaftigkeits-Schicht des Kerns; ein
// eigenes Log je Domäne, damit zwei Domänen sich nicht ins Gehege kommen.

import { createArtifactStore } from "../../../kernel/persistence/store.js";

const store = createArtifactStore("artefakte-immobilien"); // threadId -> { property, listings, status }

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
  store.patch(threadId, { status: "DELIVERED" });
}
