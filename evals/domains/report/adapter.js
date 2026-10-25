// ── evals/domains/report/adapter.js ──────────────────────────────────────
// Was der Harness über die Domäne `report` wissen muss — und sonst nichts.
// Vorher standen diese sechs Angaben verstreut in evals/runners/policy.js; sie
// waren der einzige Grund, warum ein domänenfreier Runner unmöglich war.
//
// Die Importe haben eine NEBENWIRKUNG: `domain.js` registriert die Domäne. Der
// Adapter wird deshalb erst geladen, wenn TRACE_DIR und STATE_DIR stehen
// (siehe evals/domains/index.js).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  guardrailSchwellen,
  reportDomain,
} from "../../../src/domains/report/domain.js";
import { getRunner } from "../../../src/kernel/registry.js";
import { getArtifact } from "../../../src/domains/report/agents/fileSaver.js";
import {
  enqueueAction,
  getQueue,
  simulationsExecutor,
  startActionWorker,
  stopActionWorker,
} from "../../../src/domains/report/actions.js";

const hier = path.dirname(fileURLToPath(import.meta.url));

export const adapter = {
  name: reportDomain.name,

  // Der Eingangsknoten. Der Runner erkennt „blockiert" STRUKTURELL — der Lauf
  // endet nach dem Eingang — und darf dafür keinen Knotennamen kennen.
  eingang: reportDomain.entry,

  // Dieselbe Grenze wie im Code, nicht eine zweite Kopie der Zahl.
  guardrailSchwellen,

  runner: getRunner(reportDomain.name),

  // Der Artefaktstatus ist Bedeutung der Domäne: `report` veröffentlicht,
  // `immobilien` liefert aus. Der Runner vergleicht nur Zeichenketten.
  artefaktstatus: (threadId) => getArtifact(threadId)?.status ?? null,

  aktionen: {
    enqueueAction,
    getQueue,
    startActionWorker,
    stopActionWorker,
    executor: simulationsExecutor,
  },

  datensatz: JSON.parse(
    fs.readFileSync(path.join(hier, "golden", "tasks.json"), "utf8"),
  ),
};
