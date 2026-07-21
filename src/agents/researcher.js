// ── agents/researcher.js ─────────────────────────────────────────────────
// AJAN #1 — burada sistem TEK AJAN olarak hayata basladi.
// Sorumluluk: gorev hakkinda bilgi toplamak (web arama / LLM ozet).
//
// Kurucu Dersi: "Tek sorumluluk" ajani > "her seyi yapan" ajan.
// Scraping + analiz + yazma AYNI dugumde birlesmez. Cunku: ayri test edilir,
// prompt'lar kisa/odakli kalir, plan-bazli yetkilendirilebilir.

import { llmText } from "../services/llm.js";

export async function researcherNode(state) {
  const research = await llmText(
    "Sen bir arastirma asistanisin. Verilen konu hakkinda 3-5 maddelik ozlu, olgusal notlar uret.",
    state.task,
  );
  return {
    research: String(research),
    nextAgent: "orchestrator", // her ajan hub'a geri doner
    log: ["🔎 researcher: arastirma tamamlandi"],
  };
}
