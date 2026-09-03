// ── evals/runners/policy.js ──────────────────────────────────────────────
// SCHICHT A — Richtlinien und Routing, im Mock-Modus, deterministisch und
// kostenlos. Sie misst NICHT die Qualität der LLM-Ausgabe (das ist Schicht B,
// Phase 4), sondern ob die Zusagen halten, die nie brechen dürfen.
//
// Die Agentenreihenfolge und der Bedrohungswert werden aus dem TRACE gelesen,
// nicht aus dem Event-Bus. Das ist der Grund, warum der Trace vor dem Harness
// entstand (I1): der Bus zeigt an und vergisst, der Trace bleibt und ist
// nachprüfbar — wer eine Zahl anzweifelt, kann die Zeile aufschlagen.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(hier, "..");
const wurzel = path.resolve(evalsDir, "..");

// Traces dieses Laufs an einen eigenen Ort, damit sie nicht mit Demo-Läufen
// durcheinandergeraten.
const traceDir = path.join(evalsDir, "traces");
process.env.TRACE_DIR = traceDir;

const { MOCK_LLM } = await import("../../src/kernel/config/env.js");
if (!MOCK_LLM) {
  console.error(
    "Schicht A läuft nur im Mock-Modus (ADR-0008). ANTHROPIC_API_KEY ist gesetzt — " +
      "ein echtes Modell macht diese Messung nichtdeterministisch und kostenpflichtig.",
  );
  process.exit(1);
}

await import("../../src/domains/report/domain.js");
const { getRunner } = await import("../../src/kernel/registry.js");
const { getArtifact } =
  await import("../../src/domains/report/agents/fileSaver.js");
const { enqueueAction, getQueue, startActionWorker, stopActionWorker } =
  await import("../../src/domains/report/actions.js");
const { cost } = await import("../../src/kernel/observability/costTracker.js");
const { onLlmCall } = await import("../../src/kernel/llm/adapter.js");
const { berechneMetriken, vertragstreue } = await import("../metrics/index.js");

const { startWorkflow, resolveApproval } = getRunner("report");

const datensatz = JSON.parse(
  fs.readFileSync(
    path.join(evalsDir, "domains", "report", "golden", "tasks.json"),
    "utf8",
  ),
);

// ── Einen Workflow-Fall ausführen ────────────────────────────────────────
async function laufWorkflow(aufgabe) {
  const threadId = crypto.randomUUID();
  const inputTokens = [];
  let kostenUsd = 0;
  // Je Aufruf summieren statt Delta eines wachsenden Zählers zu nehmen: sonst
  // weicht dieselbe Messung im zweiten Durchgang in den letzten Bits ab und
  // der Determinismus-Nachweis meldet einen Unterschied, den es nicht gibt.
  const abmelden = onLlmCall((c) => {
    inputTokens.push(c.inputTokens);
    kostenUsd += c.usd;
  });

  let fehler = null;
  let endstatus = null;

  if (aufgabe.gedrosselt) cost.setThrottled(true);
  try {
    const { interrupted } = await startWorkflow({
      task: aufgabe.task,
      threadId,
    });
    endstatus = interrupted ? "AWAITING_APPROVAL" : "DONE";

    if (interrupted && aufgabe.genehmigung !== null) {
      await resolveApproval({ threadId, approved: aufgabe.genehmigung });
      endstatus = aufgabe.genehmigung ? "PUBLISHED" : "REJECTED";
    }
  } catch (e) {
    fehler = e.message;
  } finally {
    if (aufgabe.gedrosselt) cost.setThrottled(false);
    abmelden();
  }

  // Der Trace ist die Quelle für Reihenfolge und Bedrohungswert.
  const zeilen = leseTrace(threadId);
  const sequenz = zeilen.filter((z) => z.type === "node").map((z) => z.node);
  const guardrailZeile = zeilen.find((z) => z.node === "guardrail");
  const threatScore = guardrailZeile?.threatScore ?? null;

  return {
    id: aufgabe.id,
    gruppe: aufgabe.gruppe,
    art: "workflow",
    genehmigung: aufgabe.genehmigung,
    sequenz,
    endstatus,
    artefaktstatus: getArtifact(threadId)?.status ?? null,
    queueEintraege: getQueue().filter((a) => a.threadId === threadId).length,
    threatScore,
    guardrail: bewerteGuardrail(sequenz, threatScore, aufgabe),
    llmAufrufe: inputTokens.length,
    inputTokens,
    kostenUsd,
    fehler,
    erwartet: aufgabe.erwartet,
    abweichungen: [],
  };
}

function leseTrace(threadId) {
  try {
    return fs
      .readFileSync(path.join(traceDir, `${threadId}.jsonl`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((z) => JSON.parse(z));
  } catch {
    return [];
  }
}

// Drei Wege des Guardrails, aus dem Trace abgeleitet.
function bewerteGuardrail(sequenz, threatScore, aufgabe) {
  if (aufgabe.gedrosselt) return "gedrosselt";
  if (sequenz.length === 1 && sequenz[0] === "guardrail") return "blockiert";
  if (threatScore >= 3) return "sanitisiert";
  return "durchgelassen";
}

// ── Einen Aktions-Fall ausführen ─────────────────────────────────────────
async function laufAktion(aufgabe) {
  const threadId = crypto.randomUUID();
  let eingereiht = true;
  let id = null;
  try {
    id = enqueueAction({
      threadId,
      actionType: aufgabe.actionType,
      payload: aufgabe.payload,
    });
  } catch {
    eingereiht = false; // TOR 1 hat vor dem Schreiben abgelehnt
  }

  if (eingereiht) {
    startActionWorker(5);
    await new Promise((r) => setTimeout(r, 60));
    stopActionWorker();
  }

  return {
    id: aufgabe.id,
    gruppe: aufgabe.gruppe,
    art: "aktion",
    genehmigung: null,
    sequenz: [],
    endstatus: getQueue().find((a) => a.id === id)?.status ?? null,
    artefaktstatus: null,
    queueEintraege: 0, // zählt nicht als Workflow-Aktion (Metrik 3.2)
    threatScore: null,
    guardrail: null,
    llmAufrufe: 0,
    inputTokens: [],
    kostenUsd: 0,
    fehler: null,
    eingereiht,
    erwartet: aufgabe.erwartet,
    abweichungen: [],
  };
}

// ── Ergebnis gegen die Erwartung halten ──────────────────────────────────
function pruefe(lauf, sequenzen) {
  const e = lauf.erwartet ?? {};
  const ab = lauf.abweichungen;

  if (lauf.art === "aktion") {
    if (e.eingereiht !== undefined && lauf.eingereiht !== e.eingereiht)
      ab.push(`eingereiht: ${lauf.eingereiht} statt ${e.eingereiht}`);
    if (e.endstatus !== undefined && lauf.endstatus !== e.endstatus)
      ab.push(`endstatus: ${lauf.endstatus} statt ${e.endstatus}`);
    return lauf;
  }

  const erwarteteSequenz = sequenzen[e.sequenz];
  if (
    erwarteteSequenz &&
    JSON.stringify(lauf.sequenz) !== JSON.stringify(erwarteteSequenz)
  ) {
    ab.push(
      `Sequenz weicht ab: [${lauf.sequenz.join(" → ")}] statt [${erwarteteSequenz.join(" → ")}]`,
    );
  }
  if (e.endstatus !== undefined && lauf.endstatus !== e.endstatus)
    ab.push(`endstatus: ${lauf.endstatus} statt ${e.endstatus}`);
  if (
    e.artefaktstatus !== undefined &&
    lauf.artefaktstatus !== e.artefaktstatus
  )
    ab.push(`artefaktstatus: ${lauf.artefaktstatus} statt ${e.artefaktstatus}`);
  if (
    e.queueEintraege !== undefined &&
    lauf.queueEintraege !== e.queueEintraege
  )
    ab.push(`queueEintraege: ${lauf.queueEintraege} statt ${e.queueEintraege}`);
  if (e.threatScore !== undefined && lauf.threatScore !== e.threatScore)
    ab.push(`threatScore: ${lauf.threatScore} statt ${e.threatScore}`);
  if (e.guardrail !== undefined && lauf.guardrail !== e.guardrail)
    ab.push(`guardrail: ${lauf.guardrail} statt ${e.guardrail}`);
  if (e.llmAufrufe !== undefined && lauf.llmAufrufe !== e.llmAufrufe)
    ab.push(`llmAufrufe: ${lauf.llmAufrufe} statt ${e.llmAufrufe}`);
  if (e.writerAufrufe !== undefined) {
    const n = lauf.sequenz.filter((s) => s === "writer").length;
    if (n !== e.writerAufrufe)
      ab.push(`writerAufrufe: ${n} statt ${e.writerAufrufe}`);
  }
  if (e.criticAufrufe !== undefined) {
    const n = lauf.sequenz.filter((s) => s === "critic").length;
    if (n !== e.criticAufrufe)
      ab.push(`criticAufrufe: ${n} statt ${e.criticAufrufe}`);
  }
  return lauf;
}

async function durchgang() {
  const laeufe = [];
  for (const aufgabe of datensatz.aufgaben) {
    const lauf =
      aufgabe.art === "aktion"
        ? await laufAktion(aufgabe)
        : await laufWorkflow(aufgabe);
    laeufe.push(pruefe(lauf, datensatz.sequenzen));
  }
  return laeufe;
}

// ── Ausführen: zwei Durchgänge, weil Determinismus beweispflichtig ist ────
fs.mkdirSync(traceDir, { recursive: true });

const erster = await durchgang();
const zweiter = await durchgang();

const metriken = berechneMetriken(erster, zweiter);
const treue = vertragstreue(erster);

// Der Determinismus-Nachweis vergleicht die MESSWERTE beider Durchgänge —
// nicht den Bericht, der einen Zeitstempel trägt.
const metrikenZweiter = berechneMetriken(zweiter, erster);
const deterministisch =
  JSON.stringify(metriken) === JSON.stringify(metrikenZweiter);

const bericht = {
  erzeugt: new Date().toISOString(),
  schicht: "A",
  modus: "mock",
  domaene: "report",
  aufgaben: datensatz.aufgaben.length,
  deterministisch,
  vertragstreue: treue,
  metriken,
};

const reportDir = path.join(evalsDir, "reports");
fs.mkdirSync(reportDir, { recursive: true });
const datei = path.join(
  reportDir,
  `${bericht.erzeugt.slice(0, 10)}-schicht-a.json`,
);
fs.writeFileSync(datei, JSON.stringify(bericht, null, 2) + "\n");

// ── Konsolenausgabe ──────────────────────────────────────────────────────
const proz = (w) =>
  w === null ? "nicht messbar" : `${(w * 100).toFixed(1)} %`;
const zeile = (m) =>
  `  ${m.name.padEnd(38)} ${proz(m.wert).padStart(13)}   (${m.zaehler}/${m.nenner})`;

console.log(
  `\nSchicht A · Domäne ${bericht.domaene} · ${bericht.aufgaben} Aufgaben · Mock\n`,
);
console.log(zeile(metriken["3.1"]));
console.log(zeile(metriken["3.2"]));
console.log(zeile(metriken["3.3"]));
console.log(zeile(metriken["3.4"]));
console.log(
  `  ${metriken["3.5"].name.padEnd(38)} P ${proz(metriken["3.5"].praezision)} · R ${proz(metriken["3.5"].trefferquote)}   (TP ${metriken["3.5"].tp} · FP ${metriken["3.5"].fp} · FN ${metriken["3.5"].fn})`,
);
console.log(
  `  ${metriken["3.6"].name.padEnd(38)} Median ${metriken["3.6"].median?.toFixed(6)} USD   (${metriken["3.6"].nenner})`,
);
console.log(
  `  ${metriken["3.12"].name.padEnd(38)} Median ×${metriken["3.12"].medianVerhaeltnis?.toFixed(2)} · p90 ×${metriken["3.12"].p90Verhaeltnis?.toFixed(2)} · Spitze ${metriken["3.12"].p90SpitzeTokens} Token`,
);

console.log(
  `\n  Vertragstreue: ${treue.zaehler}/${treue.nenner} Aufgaben wie erwartet`,
);
for (const a of treue.abweichungen) {
  console.log(`   🔴 ${a.id} (${a.gruppe})`);
  for (const p of a.punkte) console.log(`      ${p}`);
}
console.log(
  `  Determinismus (zwei Durchgänge): ${deterministisch ? "🟢 identisch" : "🔴 abweichend"}`,
);
console.log(`\n  Bericht: ${path.relative(wurzel, datei)}\n`);

// Ein Harness, der immer grün meldet, misst nichts. Rot ist ein Ergebnis,
// kein Absturz — der Exit-Code trägt es nach CI.
const bestanden =
  deterministisch &&
  treue.zaehler === treue.nenner &&
  metriken["3.1"].erfuellt !== false &&
  metriken["3.2"].erfuellt !== false &&
  metriken["3.3"].erfuellt !== false &&
  metriken["3.4"].erfuellt !== false;

process.exit(bestanden ? 0 : 1);
