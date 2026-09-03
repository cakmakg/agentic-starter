// ── kernel/observability/costTracker.js ──────────────────────────────────────────────
// Kostenverfolgung Token → USD + AUTOMATISCHER BUDGET-KILL-SWITCH.
//
// Gründerlektion: In einem System, das Geld ausgibt, ist Kosten ein
// SICHERHEITSTHEMA. Ein Schleifenfehler oder eine böswillige Nutzerin kann über
// Nacht eine dreistellige LLM-Rechnung erzeugen. Der Budget-Kill-Switch ist eine
// finanzielle Brandmauer. Bau ihn ab dem ersten Tag ein.

import { env } from "../config/env.js";

// Beispielpreise Sonnet 4.6: Input $3 / Output $15 (je 1 Mio. Token).
const PRICE = { in: 3 / 1_000_000, out: 15 / 1_000_000 };

let monthlySpendUsd = 0;
let throttled = false; // Sobald true, bricht der Guardrail den nächsten Workflow ab.

export function trackUsage({ inputTokens = 0, outputTokens = 0 }) {
  const cost = inputTokens * PRICE.in + outputTokens * PRICE.out;
  monthlySpendUsd += cost;
  if (monthlySpendUsd >= env.monthlyBudgetUsd) throttled = true;
  return cost;
}

export const cost = {
  isThrottled: () => throttled,
  spend: () => monthlySpendUsd,
  // Manueller Kill-Switch (Admin-Knopf "throttle").
  setThrottled: (v) => {
    throttled = Boolean(v);
  },
  reset: () => {
    monthlySpendUsd = 0;
    throttled = false;
  },
};
