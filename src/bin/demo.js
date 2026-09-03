// ── bin/demo.js ──────────────────────────────────────────────────────────
// Zeigt den kompletten Ablauf ohne HTTP in einem einzigen Befehl: npm run demo
// Researcher → Writer ⇄ Critic → fileSaver → (HITL HÄLT AN) → Genehmigung → Publisher → END
//
// Das ist der schnellste Weg, das System zu VERSTEHEN: schau der Konsole zu und
// sieh, was jeder Agent tut.
//
// Bis Phase 2 schlug dieser Lauf am Rekursionslimit fehl; die Ursache lag in
// BREMSE 6 des Routers. Behoben in T2.2 — der Lauf geht bis PUBLISHED durch.

import crypto from "node:crypto";

import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/observability/eventBus.js";
import "../domains/report/domain.js";
import { getArtifact } from "../domains/report/agents/fileSaver.js";

const { startWorkflow, resolveApproval } = getRunner("report");
const threadId = crypto.randomUUID();

// Statt SSE: direkt am Event-Bus lauschen und auf die Konsole schreiben.
agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
  if (ev.type === "workflow_complete")
    console.log(`\n=== workflow_complete: ${ev.status} ===\n`);
});

console.log("\n▶  Workflow startet...\n");
const { interrupted } = await startWorkflow({
  task: "Ein kurzer Bericht über KI-Werbetrends 2026 im deutschen Immobilienmarkt.",
  threadId,
});

if (interrupted) {
  console.log(
    "⏸  Der Graph HÄLT bei human_approval (interruptBefore). Artefakt:",
  );
  console.log("   status:", getArtifact(threadId)?.status);
  console.log("\n▶  Der Mensch GENEHMIGT → publisher läuft...\n");
  await resolveApproval({ threadId, approved: true });
  console.log("✓ Endgültiger Artefaktstatus:", getArtifact(threadId)?.status);
}
process.exit(0);
