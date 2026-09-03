// ── domains/report/agents/writer.js ──────────────────────────────────────
// Der Agent, der das finale Artefakt erzeugt. Die "produzierende" Seite der
// Revisionsschleife Writer ⇄ Critic.
//
// Wichtig: dieser Knoten ERHÖHT revisionCount (liefert bei jedem Aufruf +1).
// Der Akkumulator-Reducer im Kern summiert sie; BREMSE 3 fängt das Limit ab.
// Das ist der Schutzschalter gegen eine endlose Writer-⇄-Critic-Schleife.
//
// Seit Phase 2 (T2.2) kehrt der Router nach einer Ablehnung über BREMSE 6b
// hierher zurück; der Zähler wächst also, und das harte Limit greift wirklich.

import { llmText } from "../../../kernel/llm/adapter.js";
import { modelFor } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";

export async function writerNode(state) {
  const draft = await llmText(
    prompts.writer.system,
    prompts.writer.user(state),
    modelFor("writer"),
  );

  return {
    draft: String(draft),
    revisionCount: 1, // der Akkumulator-Reducer addiert +1 → Schutzschalter
    isApproved: null, // neuer Entwurf → der Critic soll erneut prüfen
    nextAgent: "orchestrator",
    log: [`✍️ writer: Entwurf erstellt (Revision ${state.revisionCount + 1})`],
  };
}
