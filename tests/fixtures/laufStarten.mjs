// ── tests/fixtures/laufStarten.mjs ───────────────────────────────────────
// ERSTER Prozess der T11-Prüfung. Startet einen Workflow und LÄSST IHN
// STEHEN — bis `human_approval`, wo der Graph anhält. Danach endet der Prozess.
//
// Das ist kein Testhelfer aus Bequemlichkeit: T11 verlangt wörtlich, dass „der
// Prozess neu gestartet" wird. Denselben Ablauf innerhalb eines Prozesses
// nachzustellen würde die Zusage nicht prüfen, sondern umgehen — der
// Arbeitsspeicher wäre ja noch da.
//
// Aufruf: node laufStarten.mjs <threadId>   (STATE_DIR/TRACE_DIR aus der Umgebung)

const threadId = process.argv[2];

await import("../../src/domains/report/domain.js");
const { getRunner } = await import("../../src/kernel/registry.js");
const { getArtifact } =
  await import("../../src/domains/report/agents/fileSaver.js");

const { startWorkflow } = getRunner("report");
const { interrupted } = await startWorkflow({
  task: "Ein kurzer Bericht über Mietpreise im Bestand.",
  threadId,
});

// Eine Zeile, die der Test liest. Mehr Protokoll wäre hier nur Rauschen.
console.log(
  JSON.stringify({
    pid: process.pid,
    interrupted,
    artefakt: getArtifact(threadId)?.status ?? null,
  }),
);

process.exit(0);
