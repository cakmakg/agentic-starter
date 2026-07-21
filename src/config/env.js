// ── config/env.js ────────────────────────────────────────────────────────
// Tek bir yerden env okuma + dogrulama. Kural: env'i kodun her yerinde
// process.env ile DEGIL, buradan import ederek kullan. Boylece "hangi env
// degiskenleri var?" sorusunun tek cevabi bu dosyadir.

import fs from "node:fs";
import path from "node:path";

// Cok minik .env yukleyici (dependency eklemeden). Production'da dotenv kullan.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export const env = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.MODEL || "claude-sonnet-4-6",
  apiKey: process.env.API_KEY || "dev-local-key",
  monthlyBudgetUsd: Number(process.env.MONTHLY_BUDGET_USD || 5),
  port: Number(process.env.PORT || 3000),
};

// LLM anahtari yoksa "mock mod": gercek cagri yapilmaz. (fromhometohotel'deki
// mock-mode deseninin aynisi — API anahtari olmadan da sistem uctan uca calisir.)
export const MOCK_LLM = !env.anthropicKey;
