// ── demo.js ──────────────────────────────────────────────────────────────
// HTTP olmadan tum akisi tek komutta gosterir:  npm run demo
// Researcher → Writer ⇄ Critic → fileSaver → (HITL DUR) → onay → Publisher → END
//
// Bu, sistemi OGRENMEK icin en hizli yol: konsolu izle, her ajanin ne yaptigini gor.

import crypto from "node:crypto";
import { startWorkflow, resolveApproval } from "./workflow/runner.js";
import { agentEventBus } from "./lib/eventBus.js";
import { getArtifact } from "./agents/fileSaver.js";

const threadId = crypto.randomUUID();

// SSE yerine: event bus'i dogrudan dinle, konsola bas.
agentEventBus.on(threadId, (ev) => {
  if (ev.type === "agent_log") console.log("   " + ev.line);
  if (ev.type === "workflow_complete") console.log(`\n=== workflow_complete: ${ev.status} ===\n`);
});

console.log("\n▶  Workflow basliyor...\n");
const { interrupted } = await startWorkflow({
  task: "Almanya emlak pazarinda 2026 yapay zeka reklam trendleri hakkinda kisa bir rapor.",
  threadId,
});

if (interrupted) {
  console.log("⏸  Graf human_approval'da DURDU (interruptBefore). Artefakt:");
  console.log("   status:", getArtifact(threadId)?.status);
  console.log("\n▶  Insan ONAY veriyor → publisher calisacak...\n");
  await resolveApproval({ threadId, approved: true });
  console.log("✓ Final artefakt durumu:", getArtifact(threadId)?.status);
}
process.exit(0);
