// ── domains/immobilien/actions.js ────────────────────────────────────────
// Erlaubte Aktionstypen und ihre Payload-Schemata (wie domains/report/actions.js).
// Die Mechanik der Queue steht im Kern (ADR-0018); die Whitelist gehört hierher.
//
// PUBLISH_LISTING liefert heute nur an die Queue — der echte Portal-Aufruf
// (offizielle API/Import-Schnittstelle, siehe docs/kundenerkundung-immobilien.md
// §5) ist ein eigener Schritt in Phase 5 und noch nicht gebaut.

import { createActionQueue } from "../../kernel/security/actionQueue.js";

export const whitelist = ["PUBLISH_LISTING"];

export const validators = {
  PUBLISH_LISTING: (p) =>
    typeof p.portal === "string" &&
    typeof p.text === "string" &&
    p.text.length > 0 &&
    p.text.length <= 5000,
};

// Eine Queue je Domäne — eigener Modul-Singleton, getrennt von der Queue der
// Domäne `report`.
export const immobilienQueue = createActionQueue({ whitelist, validators });

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  immobilienQueue;
