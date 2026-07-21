// ── agents/orchestrator.js ───────────────────────────────────────────────
// Sistemin BEYNI. Hub-and-spoke'un merkezi: her ajan buraya geri doner,
// orchestrator "sirada kim var?" kararini yeniden verir.
//
// Routing UC KATMANLI kurulur (Kurucu Dersi: LLM jüri uyesidir, hakim degil):
//   1) Deterministik FREN'ler  → vakalarin %90'ini SIFIR LLM maliyetiyle cozer.
//   2) LLM (yapisal cikti)      → sadece hicbir fren eslesmezse, belirsizlik icin.
//   3) Post-LLM dogrulama       → LLM'in sectigi ajan gecerli mi? Degilse override.

import { z } from "zod";
import { llmStructured } from "../services/llm.js";

const MAX_REVISIONS = 5; // sert devre kesici

const VALID_AGENTS = ["researcher", "writer", "critic", "fileSaver", "human_approval", "END"];

const routingSchema = z.object({
  nextAgent: z.enum(["researcher", "writer", "critic", "fileSaver", "END"]),
  reason: z.string(),
});

export async function orchestratorNode(state) {
  const log = [];

  // ── FREN 1: Yayinlandiysa dur (yayin sonrasi tekrar donguye girme).
  if (state.isPublished) {
    return { nextAgent: "END", log: ["🧠 FREN1: yayinlandi → END"] };
  }

  // ── FREN 2: Dosya kaydedildi ama insan karari yok → HITL.
  //    HITL kararini ASLA LLM'e birakma — deterministik olarak insana goturur.
  if (state.fileSaved && state.humanApproval == null) {
    return { nextAgent: "human_approval", log: ["🧠 FREN2: dosya hazir → insan onayi"] };
  }

  // ── FREN 3: Cok fazla revizyon → sert kes, insana goturur.
  if (state.revisionCount >= MAX_REVISIONS) {
    return { nextAgent: "human_approval", log: [`🧠 FREN3: revizyon limiti (${state.revisionCount}) → insan onayi`] };
  }

  // ── FREN 4: Arastirma yoksa once arastir.
  if (!state.research) {
    return { nextAgent: "researcher", log: ["🧠 FREN4: arastirma yok → researcher"] };
  }

  // ── FREN 5: Arastirma var, taslak yoksa yaz.
  if (state.research && !state.draft) {
    return { nextAgent: "writer", log: ["🧠 FREN5: arastirma var, taslak yok → writer"] };
  }

  // ── FREN 6: Taslak var ama critic onaylamadiysa denetle.
  if (state.draft && state.isApproved !== true) {
    return { nextAgent: "critic", log: ["🧠 FREN6: taslak var, onay yok → critic"] };
  }

  // ── FREN 7: Taslak onaylandiysa kaydet.
  if (state.draft && state.isApproved === true && !state.fileSaved) {
    return { nextAgent: "fileSaver", log: ["🧠 FREN7: onaylandi → fileSaver"] };
  }

  // ── KATMAN 2: Hicbir fren eslesmedi → LLM'e sor (yapisal cikti).
  const decision = await llmStructured(
    routingSchema,
    "Sen bir is akisi yonlendiricisisin. Verilen duruma gore siradaki ajani sec.",
    `Durum: research=${!!state.research}, draft=${!!state.draft}, approved=${state.isApproved}. Task: ${state.task}`,
    () => ({ nextAgent: "END", reason: "mock: fren disi durum, guvenli END" }), // mock fallback
  );

  // ── KATMAN 3: Post-LLM dogrulama. Gecersiz ajan → guvenli override.
  let next = decision.nextAgent;
  if (!VALID_AGENTS.includes(next)) {
    log.push(`⚠️ orchestrator: LLM gecersiz ajan dondu (${next}) → END override`);
    next = "END";
  } else {
    log.push(`🧠 LLM routing → ${next} (${decision.reason})`);
  }
  return { nextAgent: next, log };
}
