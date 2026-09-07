// ── evals/domains/immobilien/adapter.js ──────────────────────────────────
// Dasselbe Sechs-Felder-Formular wie evals/domains/report/adapter.js. Dass
// diese Datei die einzige ist, die für eine zweite gemessene Domäne entsteht,
// ist das Prüfkriterium dieses Schritts: der Runner ändert sich nicht mit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  guardrailSchwellen,
  immobilienDomain,
} from "../../../src/domains/immobilien/domain.js";
import { getRunner } from "../../../src/kernel/registry.js";
import { getListingArtifact } from "../../../src/domains/immobilien/agents/listingStore.js";
import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../../../src/domains/immobilien/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));

export const adapter = {
  name: immobilienDomain.name,
  eingang: immobilienDomain.entry,
  guardrailSchwellen,
  runner: getRunner(immobilienDomain.name),

  // AWAITING_APPROVAL → DELIVERED (nicht PUBLISHED wie in `report`): der
  // Endzustand eines Inserats heißt hier anders, und genau deshalb steht die
  // Abfrage im Adapter statt im Runner.
  artefaktstatus: (threadId) => getListingArtifact(threadId)?.status ?? null,

  aktionen: { enqueueAction, getQueue, startActionWorker, stopActionWorker },

  datensatz: JSON.parse(
    fs.readFileSync(path.join(hier, "golden", "tasks.json"), "utf8"),
  ),

};
