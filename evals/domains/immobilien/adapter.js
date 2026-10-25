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
  MAX_REVISIONS,
} from "../../../src/domains/immobilien/domain.js";
import { getRunner } from "../../../src/kernel/registry.js";
import { getListingArtifact } from "../../../src/domains/immobilien/agents/listingStore.js";
import {
  listingWriterNode,
  TARGET_PORTALS,
} from "../../../src/domains/immobilien/agents/listingWriter.js";
import { contractCheckerNode } from "../../../src/domains/immobilien/agents/contractChecker.js";
import {
  enqueueAction,
  getQueue,
  startActionWorker,
  stopActionWorker,
} from "../../../src/domains/immobilien/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));

// Schicht A misst Tor 1 und Tor 2, nicht die Wirkung (ADR-0031 Teil 6): der
// Test-Executor antwortet wie der Kern auf eine ausgeführte Aktion. Die Wirkung
// über den Kern belegt der Integrationstest.
const testExecutor = async () => ({ outcome: "executed", result: {} });

export const adapter = {
  name: immobilienDomain.name,
  eingang: immobilienDomain.entry,
  guardrailSchwellen,
  runner: getRunner(immobilienDomain.name),

  // AWAITING_APPROVAL → DELIVERED (nicht PUBLISHED wie in `report`): der
  // Endzustand eines Inserats heißt hier anders, und genau deshalb steht die
  // Abfrage im Adapter statt im Runner.
  artefaktstatus: (threadId) => getListingArtifact(threadId)?.status ?? null,

  aktionen: {
    enqueueAction,
    getQueue,
    startActionWorker,
    stopActionWorker,
    executor: testExecutor,
  },

  datensatz: JSON.parse(
    fs.readFileSync(path.join(hier, "golden", "tasks.json"), "utf8"),
  ),

  // ── SCHICHT B (T8) ─────────────────────────────────────────────────────
  // Der Ausgabevertrag gegen ein ECHTES Modell. Optionales Feld: `report` hat
  // es nicht, deshalb fährt `npm run evals:quality` nur diese Domäne.
  //
  // Gemessen werden Writer und Tor als PAAR, nicht der Graph. Routing, HITL
  // und Auslieferung misst Schicht A und kosten hier nur Geld; T8 fragt einzig,
  // ob der erzeugte Text seinen Vertrag erfüllt. Der Aufruf geht deshalb direkt
  // an dieselben zwei Knotenfunktionen, die auch der Graph aufruft — nicht an
  // eine nachgebaute Schleife.
  schichtB: {
    // Die zehn Datensätze der Kundenerkundung, nicht die Entwicklungs-Fixture:
    // hier zählt die Bandbreite echter Feldbelegungen (leere Etage, fehlender
    // Energieausweis, dezimale Wohnfläche, Provision als Text).
    faelle: JSON.parse(
      fs.readFileSync(path.join(hier, "golden", "portfolio.json"), "utf8"),
    ).objekte.map((o) => ({ id: o.id, gegenstand: o })),

    varianten: TARGET_PORTALS,

    // Das Revisionslimit der Domäne, damit der Harness keine zweite Kopie
    // derselben Zahl trägt (dieselbe Regel wie bei den Guardrail-Schwellen).
    maxVersuche: MAX_REVISIONS,

    // Ein einzelnes Inserat schreiben lassen. `listings` bekommt Platzhalter
    // für die vorangehenden Portale, damit listingWriter genau das gewünschte
    // als "fehlend" wählt; gelesen wird nur der frisch erzeugte Text.
    async schreibe(property, portal, feedback) {
      const vorher = {};
      for (const p of TARGET_PORTALS) {
        if (p === portal) break;
        vorher[p] = "(bereits geschrieben)";
      }
      const r = await listingWriterNode({
        property,
        listings: vorher,
        contractFeedback: feedback ?? "",
      });
      return r.listings[portal];
    },

    // Dasselbe Tor wie im Graphen, auf einen Text angewandt.
    pruefe(text, property) {
      const r = contractCheckerNode({ listings: { pruef: text }, property });
      return {
        konform: r.isContractValid === true,
        gruende: r.contractFeedback || "",
      };
    },
  },
};
