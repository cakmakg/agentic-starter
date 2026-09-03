// ── domains/immobilien/agents/delivery.js ────────────────────────────────
// Terminaler Agent (wie publisher.js in domains/report). Zentrale MOAT-Regel:
//
//   AGENTEN RUFEN NIEMALS DIREKT EINE EXTERNE API AUF.
//
// delivery SCHREIBT nur in die ActionQueue, je Portal ein Eintrag. Der echte
// Portal-Aufruf (offizielle API/Import-Schnittstelle statt Scraping, siehe
// docs/kundenerkundung-immobilien.md §5) ist ein separater, noch nicht
// gebauter Executor — heute simuliert der Queue-Worker nur (EXTEND.md §6).

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
