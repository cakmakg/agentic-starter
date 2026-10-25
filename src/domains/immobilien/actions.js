// ── domains/immobilien/actions.js ────────────────────────────────────────
// Erlaubte Aktionstypen und ihre Payload-Schemata (wie domains/report/actions.js).
// Die Mechanik der Queue steht im Kern (ADR-0018); die Whitelist gehört hierher.
//
// PUBLISH_LISTING wird über den Security Core ausgeführt (ADR-0031): der Worker
// fragt dort `publish_listing` an, der Tool Adapter auf der Vertrauensseite
// spricht das Portal an — heute ein Scheinportal; das echte Portal ist Stufe 2
// (docs/kern-integration.md). Den Executor setzt bin/demoImmobilien.js ein: eine
// Domäne importiert keinen Adapter (ARCHITECTURE.md §6).

import { createActionQueue } from "../../kernel/security/actionQueue.js";

export const whitelist = ["PUBLISH_LISTING"];

// Der Name, unter dem der Security Core die Aktion kennt. Er muss dem Muster
// ^[a-z][a-z0-9_]{0,63}$ folgen, deshalb ist es nicht der Queue-Typ selbst
// (ADR-0031 Teil 7).
export const kernNamen = { PUBLISH_LISTING: "publish_listing" };

export const validators = {
  PUBLISH_LISTING: (p) =>
    typeof p.portal === "string" &&
    typeof p.text === "string" &&
    p.text.length > 0 &&
    p.text.length <= 5000,
};

// Eine Queue je Domäne — eigener Modul-Singleton, getrennt von der Queue der
// Domäne `report`.
export const immobilienQueue = createActionQueue({
  whitelist,
  validators,
  logName: "aktionen-immobilien",
});

export const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  immobilienQueue;
