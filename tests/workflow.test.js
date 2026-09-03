// ── tests/workflow.test.js ───────────────────────────────────────────────
// Der wertvollste Test des Repos: er prüft die zentrale Zusage Ende zu Ende.
// Eine Ablehnung darf nichts veröffentlichen UND nichts einreihen.
//
// Genau dieser Fall war in Phase 0 der blockierende Defekt (T2): die Kante
// human_approval → publisher war unbedingt. Behoben in T2.3. Ohne diesen Test
// könnte die Korrektur unbemerkt zurückfallen — er ist die Mutationsprobe aus
// EVALS.md §7 in ausführbarer Form.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Traces dürfen nicht ins Repo laufen: eigenes Verzeichnis, VOR dem Import.
const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-workflow-"));
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../src/kernel/config/env.js");
// Die Domäne registriert sich beim Import; der Runner kommt aus der Registry.
await import("../src/domains/report/domain.js");
const { getRunner } = await import("../src/kernel/registry.js");
const { startWorkflow, resolveApproval } = getRunner("report");
const { getArtifact } = await import("../src/domains/report/agents/fileSaver.js");
const { getQueue } = await import("../src/domains/report/actions.js");
const { cost } = await import("../src/kernel/observability/costTracker.js");

const AUFGABE = "Ein kurzer Bericht über Markttrends.";
const queueFor = (threadId) =>
  getQueue().filter((a) => a.threadId === threadId);

before(() => {
  // Ein echter Schlüssel würde hier Geld kosten und den Test nichtdeterministisch
  // machen. Lieber laut scheitern als still eine Rechnung erzeugen.
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
});

after(() => fs.rmSync(traceDir, { recursive: true, force: true }));

test("Der goldene Pfad hält vor der Genehmigung an (T1, HITL)", async () => {
  const threadId = crypto.randomUUID();
  const { interrupted } = await startWorkflow({ task: AUFGABE, threadId });

  assert.equal(interrupted, true, "Der Graph muss bei human_approval anhalten");
  assert.equal(getArtifact(threadId)?.status, "AWAITING_APPROVAL");
  assert.equal(
    queueFor(threadId).length,
    0,
    "Vor der Genehmigung darf NICHTS eingereiht sein",
  );
});

test("Eine Ablehnung stoppt die Veröffentlichung (T2 · Metrik 3.1, 3.2)", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: false });

  assert.equal(
    getArtifact(threadId)?.status,
    "AWAITING_APPROVAL",
    "Nach einer Ablehnung darf das Artefakt NICHT PUBLISHED sein",
  );
  assert.equal(
    queueFor(threadId).length,
    0,
    "Nach einer Ablehnung darf die Queue für diesen Lauf leer bleiben",
  );
});

test("Eine Genehmigung veröffentlicht und reiht genau eine Aktion ein", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: true });

  assert.equal(getArtifact(threadId)?.status, "PUBLISHED");

  const aktionen = queueFor(threadId);
  assert.equal(
    aktionen.length,
    1,
    "Genau eine Aktion je veröffentlichtem Lauf",
  );
  assert.equal(aktionen[0].actionType, "NOTIFY");
  assert.equal(
    aktionen[0].status,
    "PENDING",
    "Der Agent schreibt nur; ausgeführt wird erst durch den Worker",
  );
});

test("Der Budget-Kill-Switch bricht ab, bevor ein LLM-Aufruf entsteht", async () => {
  const threadId = crypto.randomUUID();
  cost.setThrottled(true);
  try {
    const { interrupted } = await startWorkflow({ task: AUFGABE, threadId });
    assert.equal(
      interrupted,
      false,
      "Gedrosselt darf kein HITL-Halt entstehen",
    );
    assert.equal(
      getArtifact(threadId),
      null,
      "Gedrosselt darf kein Artefakt entstehen",
    );
  } finally {
    cost.setThrottled(false);
  }
});

test("Jeder Lauf hinterlässt genau eine Trace-Datei (T2.5)", async () => {
  const threadId = crypto.randomUUID();
  await startWorkflow({ task: AUFGABE, threadId });
  await resolveApproval({ threadId, approved: true });

  const datei = path.join(traceDir, `${threadId}.jsonl`);
  assert.equal(fs.existsSync(datei), true);

  const zeilen = fs
    .readFileSync(datei, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z));

  assert.equal(zeilen[0].type, "run_start");
  assert.equal(zeilen.at(-1).type, "run_end");
  assert.equal(zeilen.at(-1).status, "PUBLISHED");
  assert.equal(
    zeilen.filter((z) => z.type === "run_end").length,
    1,
    "Genau ein run_end je Lauf — sonst zählt jede spätere Auswertung doppelt",
  );
});
