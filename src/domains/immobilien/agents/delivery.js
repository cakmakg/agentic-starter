// ── domains/immobilien/agents/delivery.js ────────────────────────────────
// Terminaler Agent (wie publisher.js in domains/report). Zentrale MOAT-Regel:
//
//   AGENTEN RUFEN NIEMALS DIREKT EINE EXTERNE API AUF.
//
// delivery SCHREIBT nur in die ActionQueue, je Portal ein Eintrag. Ausgeführt
// wird über den Security Core (ADR-0031): der Worker fragt `publish_listing` an,
// der Tool Adapter auf der Vertrauensseite spricht heute ein Scheinportal an.
// Das echte Portal (offizielle API/Import-Schnittstelle statt Scraping, siehe
// docs/kundenerkundung-immobilien.md §5) ist Stufe 2 in docs/kern-integration.md.
// DELIVERED heißt deshalb „eingereiht", nicht „veröffentlicht" (ADR-0031 Teil 8).

import { enqueueAction } from "../actions.js";
import { markDelivered } from "./listingStore.js";

export function deliveryNode(state) {
  for (const [portal, text] of Object.entries(state.listings)) {
    enqueueAction({
      threadId: state.threadId,
      actionType: "PUBLISH_LISTING",
      payload: { portal, text },
    });
  }
  markDelivered(state.threadId);

  return {
    isDelivered: true,
    nextAgent: "END",
    log: [
      "📡 delivery: Inserate in die Queue gelegt (der Worker validiert und führt aus)",
    ],
  };
}
