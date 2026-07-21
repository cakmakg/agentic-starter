// ── services/costTracker.js ──────────────────────────────────────────────
// Token -> USD maliyet izleme + OTOMATIK BUTCE KILL-SWITCH.
//
// Kurucu Dersi: Para harcayan sistemde maliyet bir GUVENLIK konusudur.
// Bir dongu bug'i veya kotu niyetli kullanici gece boyunca yuzlerce dolar
// LLM faturasi uretebilir. Butce kill-switch'i bir finansal guvenlik duvaridir.
// Ilk gunden ekle.

import { env } from "../config/env.js";

// Sonnet 4.6 ornek fiyatlandirma: input $3 / output $15 (1M token basina).
const PRICE = { in: 3 / 1_000_000, out: 15 / 1_000_000 };

let monthlySpendUsd = 0;
let throttled = false; // true olunca guardrail bir sonraki workflow'u keser.

export function trackUsage({ inputTokens = 0, outputTokens = 0 }) {
  const cost = inputTokens * PRICE.in + outputTokens * PRICE.out;
  monthlySpendUsd += cost;
  if (monthlySpendUsd >= env.monthlyBudgetUsd) throttled = true;
  return cost;
}

export const cost = {
  isThrottled: () => throttled,
  spend: () => monthlySpendUsd,
  // Manuel kill-switch (admin "throttle" butonu).
  setThrottled: (v) => { throttled = Boolean(v); },
  reset: () => { monthlySpendUsd = 0; throttled = false; },
};
