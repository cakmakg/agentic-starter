// ── bin/demoImmobilien.js ────────────────────────────────────────────────
// Zeigt den kompletten Ablauf der Domäne `immobilien` ohne HTTP: npm run demo:immobilien
// portfolioLoader → listingWriter ⇄ contractChecker → listingStore →
// (HITL HÄLT AN) → Genehmigung → delivery → ActionQueue → Worker → Security Core
//
// Die Agentenseite des MVP (ADR-0031 Teil 3): liest vom Kern nur
// SECURITY_CORE_SOCKET. Kern und Scheinportal laufen als eigene Prozesse
// (bin/securityCore.js, bin/fakePortal.js). Exit 0 nur, wenn jede Aktion dieses
// Laufs DONE ist.
//
// Läuft gegen die Entwicklungs-Fixture (data/portfolioFixture.js), NICHT
// gegen einen echten Portfolio-Datensatz — erfüllt T12 nicht.

import crypto from "node:crypto";

import { env } from "../kernel/config/env.js";
import { getRunner } from "../kernel/registry.js";
import { agentEventBus } from "../kernel/observability/eventBus.js";
import "../domains/immobilien/domain.js";
import { getListingArtifact } from "../domains/immobilien/agents/listingStore.js";
import {
  getQueue,
  kernNamen,
  startActionWorker,
  stopActionWorker,
} from "../domains/immobilien/actions.js";
import { kernExecutor } from "../adapters/security-core/client.js";

// Vor allem anderen: eine fehlende Konfiguration ist kein Ergebnis einer Aktion.
// Liefe die Demo ohne Kern weiter, lägen die Inserate still auf PENDING und der
// Lauf sähe aus wie einer (ADR-0031 Teil 7).
const SOCKET_PFAD =
  process.platform === "win32" ? /^\\\\[.?]\\pipe\\[^\\]+$/ : /^\/[^\0]+$/;
if (!SOCKET_PFAD.test(env.securityCoreSocket)) {
  process.stderr.write(
    "demo: SECURITY_CORE_SOCKET muss ein absoluter Socket-Pfad sein\n",
  );
  process.exit(1);
}

const ENDZUSTAENDE = new Set(["DONE", "REJECTED", "FAILED"]);
// Länger als drei Aufrufe an der Zeitgrenze des Clients (je 10 s).
const FRIST_MS = 60_000;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

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
    "✓ Artefaktstatus:",
    getListingArtifact(threadId)?.status,
    "(eingereiht, nicht veröffentlicht — ADR-0031 Teil 8)",
  );
}

const eigene = () => getQueue().filter((a) => a.threadId === threadId);

console.log("\n▶  Worker → Security Core...\n");
startActionWorker({
  executor: kernExecutor({ socketPath: env.securityCoreSocket, kernNamen }),
  intervalMs: 100,
});
const beginn = Date.now();
while (
  !eigene().every((a) => ENDZUSTAENDE.has(a.status)) &&
  Date.now() - beginn < FRIST_MS
) {
  await warte(100);
}
stopActionWorker();

for (const a of eigene()) {
  const zusatz =
    a.result?.listingId !== undefined
      ? ` · listingId ${a.result.listingId}`
      : a.reason
        ? ` · ${a.reason}`
        : "";
  console.log(`   ${a.payload.portal}: ${a.status}${zusatz}`);
}

const alleDone =
  eigene().length > 0 && eigene().every((a) => a.status === "DONE");
process.exit(alleDone ? 0 : 1);
