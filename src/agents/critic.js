// ── agents/critic.js ─────────────────────────────────────────────────────
// QA kapisi. Writer'in taslagini denetler. Yapisal cikti (Zod) ile
// {isApproved, criticFeedback} doner. Writer<->Critic dongusunu surur.
//
// Kurucu Dersi: Uretici (writer) ile denetleyiciyi (critic) AYIR. Ayni LLM'e
// "hem yaz hem kendini elestir" dersen, kendi isini begenir. Ayri rol = ayri goz.

import { z } from "zod";
import { llmStructured } from "../services/llm.js";

const criticSchema = z.object({
  isApproved: z.boolean(),
  criticFeedback: z.string(),
});

export async function criticNode(state) {
  const result = await llmStructured(
    criticSchema,
    "Sen titiz bir editörsün. Taslagi degerlendir. Yeterince iyiyse onayla, degilse net duzeltme iste.",
    `Gorev: ${state.task}\n\nTaslak:\n${state.draft}`,
    // Mock fallback: 2. revizyonda onayla (dongunun bitisini gostermek icin).
    () => ({
      isApproved: state.revisionCount >= 2,
      criticFeedback: state.revisionCount >= 2 ? "Yeterli." : "Daha somut ornek ekle.",
    }),
  );

  return {
    isApproved: result.isApproved,
    criticFeedback: result.isApproved ? "" : result.criticFeedback,
    nextAgent: "orchestrator",
    log: [`🧪 critic: ${result.isApproved ? "ONAYLANDI" : "revizyon istendi"}`],
  };
}
