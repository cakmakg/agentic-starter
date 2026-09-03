// ── bin/demoImmobilien.js ────────────────────────────────────────────────
// Zeigt den kompletten Ablauf der Domäne `immobilien` ohne HTTP: npm run demo:immobilien
// portfolioLoader → listingWriter ⇄ contractChecker → listingStore →
// (HITL HÄLT AN) → Genehmigung → delivery → END
//
// Läuft gegen die Entwicklungs-Fixture (data/portfolioFixture.js), NICHT
// gegen einen echten Portfolio-Datensatz — erfüllt T12 nicht.

import crypto from "node:crypto";

import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/observability/eventBus.js";
import "../domains/immobilien/domain.js";
import { getListingArtifact } from "../domains/immobilien/agents/listingStore.js";

const { startWorkflow, resolveApproval } = getRunner("immobilien");
const threadId = crypto.randomUUID();

agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
  if (ev.type === "workflow_complete")
    console.log(`\n=== workflow_complete: ${ev.status} ===\n`);
});

console.log("\n▶  Workflow (immobilien) startet...\n");
const { interrupted } = await startWorkflow({
  task: "Erstelle Inserate für Objekt OBJ-001.",
  threadId,
});

if (interrupted) {
  console.log(
    "⏸  Der Graph HÄLT bei human_approval (interruptBefore). Artefakt:",
  );
  console.log("   status:", getListingArtifact(threadId)?.status);
  console.log("\n▶  Der Mensch GENEHMIGT → delivery läuft...\n");
  await resolveApproval({ threadId, approved: true });
  console.log(
    "✓ Endgültiger Artefaktstatus:",
    getListingArtifact(threadId)?.status,
  );
}
process.exit(0);
