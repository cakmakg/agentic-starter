// ── domains/report/agents/researcher.js ──────────────────────────────────
// AGENT #1 — hier begann das System als EIN EINZIGER AGENT.
// Verantwortung: Informationen zur Aufgabe sammeln.
//
// Gründerlektion: Ein Agent mit "einer Verantwortung" schlägt den Agenten, der
// "alles macht". Scraping + Analyse + Schreiben gehören NICHT in denselben Knoten.
// Denn getrennt lässt sich jeder für sich testen, die Prompts bleiben kurz und
// fokussiert, und die Berechtigung lässt sich pro Plan vergeben.

import { llmText } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";

export async function researcherNode(state) {
  const research = await llmText(
    prompts.researcher.system,
    state.task,
    modelFor("researcher"),
  );
  return {
    research: String(research),
    nextAgent: "orchestrator", // jeder Agent kehrt zum Hub zurück
    log: ["🔎 researcher: Recherche abgeschlossen"],
  };
}
