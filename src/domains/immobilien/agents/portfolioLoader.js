// ── domains/immobilien/agents/portfolioLoader.js ─────────────────────────
// AGENT #1 der Domäne `immobilien`. KEIN LLM — reines Nachschlagen.
//
// Warum ohne LLM: welches Objekt geladen wird, ist eine deterministische
// Frage (eine ID), keine, die Sprachverständnis braucht. Ein LLM hier wäre
// eine unnötige Fehlerquelle UND unnötige Kosten (EVALS.md §3.6).

import { portfolioFixture } from "../data/portfolioFixture.js";

export function portfolioLoaderNode(state) {
  const id = extractPropertyId(state.task);
  const record =
    portfolioFixture.find((r) => r.id === id) || portfolioFixture[0];
  return {
    property: record,
    nextAgent: "orchestrator",
    log: [`🏠 portfolioLoader: Objekt geladen (${record.id})`],
  };
}

function extractPropertyId(task) {
  const match = String(task || "").match(/[A-Z]{2,}-\d+/);
  return match ? match[0] : null;
}
