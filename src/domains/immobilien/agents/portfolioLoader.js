// ── domains/immobilien/agents/portfolioLoader.js ─────────────────────────
// AGENT #1 der Domäne `immobilien`. KEIN LLM — reines Nachschlagen.
//
// Warum ohne LLM: welches Objekt geladen wird, ist eine deterministische
// Frage (eine ID), keine, die Sprachverständnis braucht. Ein LLM hier wäre
// eine unnötige Fehlerquelle UND unnötige Kosten (EVALS.md §3.6).
//
// FAIL-CLOSED (ADR-0028). Findet sich keine oder eine unbekannte ID, wird
// NICHTS geladen: der Lauf endet, statt still auf den ersten Datensatz
// auszuweichen. Der frühere Rückfall war bequem und gefährlich — ein Inserat
// für das FALSCHE Objekt geht an ein Portal und trägt einen echten Preis;
// ein abgebrochener Lauf kostet eine Minute. Dieselbe Haltung wie an der
// Genehmigungskante (T2.3): im Zweifel nichts tun.

import { portfolioFixture } from "../data/portfolioFixture.js";

// Zwei Schreibweisen, weil beide real vorkommen: `OBJ-001` in dieser
// Entwicklungs-Fixture und `P01` im Datensatz der Kundenerkundung. Wer nur
// eine kennt, lädt beim anderen still das falsche Objekt.
const ID_MUSTER = /\b[A-Z]{1,}-?\d+\b/;

export function portfolioLoaderNode(state) {
  const id = extractPropertyId(state.task);
  if (!id) {
    return abbruch("keine Objekt-ID in der Aufgabe", state.task);
  }

  const record = portfolioFixture.find((r) => r.id === id);
  if (!record) {
    return abbruch(`Objekt "${id}" steht nicht im Portfolio`, state.task);
  }

  return {
    property: record,
    nextAgent: "orchestrator",
    log: [`🏠 portfolioLoader: Objekt geladen (${record.id})`],
  };
}

// Der Fehler wandert in den State, nicht nur ins Log: BREMSE1b liest ihn und
// beendet den Lauf. Ohne dieses Feld liefe BREMSE4 ("kein Objekt → laden") in
// eine Endlosschleife, weil der Lauf ewig dasselbe erfolglos versucht.
function abbruch(grund, task) {
  return {
    portfolioFehler: grund,
    nextAgent: "orchestrator",
    log: [`🏠 portfolioLoader: ABBRUCH — ${grund} (Aufgabe: "${task ?? ""}")`],
  };
}

function extractPropertyId(task) {
  const match = String(task || "").match(ID_MUSTER);
  return match ? match[0] : null;
}
