// ── agents/writer.js ─────────────────────────────────────────────────────
// Final artefakti ureten ajan. Writer <-> Critic revizyon dongusunun
// "uretici" tarafi.
//
// Onemli: bu dugum revisionCount'u ARTIRIR (her cagrida +1 doner). State'teki
// toplayici reducer bunlari toplar; orchestrator FREN3 limiti yakalar.
// Bu, sonsuz Writer<->Critic dongusune karsi devre kesicidir.

import { llmText } from "../services/llm.js";

export async function writerNode(state) {
  // Critic geri bildirimi varsa onu prompt'a kat (FEEDBACK LOOP).
  const feedback = state.criticFeedback
    ? `\n\nONCEKI ELESTIRI (mutlaka duzelt):\n${state.criticFeedback}`
    : "";

  const draft = await llmText(
    "Sen bir B2B icerik yazarisin. Arastirma notlarindan temiz, yapilandirilmis bir rapor yaz (Markdown).",
    `Gorev: ${state.task}\n\nArastirma:\n${state.research}${feedback}`,
  );

  return {
    draft: String(draft),
    revisionCount: 1,      // toplayici reducer +1 ekler → devre kesici
    isApproved: null,      // yeni taslak → tekrar critic denetlesin
    nextAgent: "orchestrator",
    log: [`✍️ writer: taslak uretildi (revizyon ${state.revisionCount + 1})`],
  };
}
