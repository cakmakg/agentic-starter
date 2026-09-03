// ── domains/report/agents/critic.js ──────────────────────────────────────
// Das QA-Tor. Prüft den Entwurf des Writers und liefert über strukturierte
// Ausgabe (Zod) {isApproved, criticFeedback}. Es treibt die Writer-⇄-Critic-Schleife.
//
// Gründerlektion: TRENNE den Produzenten (writer) vom Prüfer (critic). Sagst du
// demselben LLM "schreib und kritisiere dich selbst", findet es seine eigene
// Arbeit gut. Getrennte Rolle heißt getrenntes Auge.

import { z } from "zod";
import { llmStructured } from "../../../kernel/llm/adapter.js";
import { prompts } from "../prompts.js";

const criticSchema = z.object({
  isApproved: z.boolean(),
  criticFeedback: z.string(),
});

export async function criticNode(state) {
  const result = await llmStructured(
    criticSchema,
    prompts.critic.system,
    prompts.critic.user(state),
    // Mock-Fallback: ab der 2. Revision freigeben (um das Ende der Schleife zu zeigen).
    () => ({
      isApproved: state.revisionCount >= 2,
      criticFeedback:
        state.revisionCount >= 2
          ? "Ausreichend."
          : "Füge konkretere Beispiele hinzu.",
    }),
  );

  return {
    isApproved: result.isApproved,
    criticFeedback: result.isApproved ? "" : result.criticFeedback,
    nextAgent: "orchestrator",
    log: [
      `🧪 critic: ${result.isApproved ? "FREIGEGEBEN" : "Revision gefordert"}`,
    ],
  };
}
