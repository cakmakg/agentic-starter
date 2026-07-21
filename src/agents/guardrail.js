// ── agents/guardrail.js ──────────────────────────────────────────────────
// MOAT Layer 1 — Girdi koruması. Her workflow'un ILK dugumu.
//
// KRITIK: LLM YOK (saf regex). Cunku guvenlik kontrolunun kendisi
// prompt-injection edilemez olmali. Bir LLM ile "bu metin tehlikeli mi?"
// diye sorarsan, saldirgan o LLM'i de kandirabilir.
//
// Kurucu Dersi: Sanitization IKI sinirda yapilir — kullanici girdisi (burada)
// VE dis veri (web scrape sonucu). Dis veri de dusmandir.

import { cost } from "../services/costTracker.js";

const MAX_TASK_LENGTH = 3000;

// Agirlikli skorlama (max ~10). Kademe = ciddiyet.
const RULES = [
  { w: 3, re: /ignore (previous|all) instructions|jailbreak|DAN mode|<\/?system>/i },
  { w: 2, re: /you are now (a|an)|pretend to be|act as (a|an)/i },
  { w: 2, re: /\[INST\]|###\s*system|<\|.*?\|>/i },
  { w: 1, re: /malware|sql injection|xss|drop table/i },
];

export function guardrailNode(state) {
  // Adim 0 — KILL-SWITCH: butce asildiysa tek LLM cagrisi bile yapma.
  if (cost.isThrottled()) {
    return {
      nextAgent: "END",
      log: ["🛑 guardrail: butce asildi (throttled) — workflow kesildi"],
    };
  }

  const task = String(state.task || "").slice(0, MAX_TASK_LENGTH);
  let score = 0;
  for (const r of RULES) if (r.re.test(task)) score += r.w;

  // 3 yonlu karar.
  if (score >= 8) {
    // ENGELLE.
    return {
      nextAgent: "END",
      threatScore: score,
      log: [`🛡️ guardrail: tehdit ENGELLENDI (skor ${score})`],
    };
  }
  if (score >= 3) {
    // SANITIZE (maskele) ve devam et.
    const cleaned = task.replace(/ignore (previous|all) instructions/gi, "[filtered]");
    return {
      task: cleaned,
      nextAgent: "orchestrator",
      threatScore: score,
      log: [`🧼 guardrail: girdi sanitize edildi (skor ${score})`],
    };
  }
  // TEMIZ.
  return { nextAgent: "orchestrator", threatScore: 0, log: ["✅ guardrail: temiz"] };
}
