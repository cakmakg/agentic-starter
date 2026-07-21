// ── services/llm.js ──────────────────────────────────────────────────────
// Tek LLM giris noktasi. Tum ajanlar buradan gecer. Iki sey saglar:
//   1) Yapisal cikti (withStructuredOutput) — Zod semasina zorlanmis guvenilir cevap.
//   2) MOCK MOD — ANTHROPIC_API_KEY yoksa gercek cagri yapmadan deterministik
//      sahte cevap doner. Boylece anahtar olmadan tum akis test edilebilir.
//
// Kurucu Dersi: LLM'i tek bir adaptore sakla. Yarin modeli/saglayiciyi
// degistirmek istersen tek dosya degisir, 15 ajan degil.

import { env, MOCK_LLM } from "../config/env.js";
import { trackUsage } from "./costTracker.js";

let _model = null;
async function getModel() {
  if (_model) return _model;
  const { ChatAnthropic } = await import("@langchain/anthropic");
  _model = new ChatAnthropic({ model: env.model, apiKey: env.anthropicKey, temperature: 0.3 });
  return _model;
}

// Kabaca token tahmini (mock modda maliyet simulasyonu icin).
const estTokens = (s) => Math.ceil((s || "").length / 4);

// Serbest metin cevabi.
export async function llmText(systemPrompt, userPrompt) {
  if (MOCK_LLM) {
    trackUsage({ inputTokens: estTokens(systemPrompt + userPrompt), outputTokens: 60 });
    return `[MOCK] ${userPrompt.slice(0, 80)} ... (mock cevap; gercek LLM icin ANTHROPIC_API_KEY ekle)`;
  }
  const model = await getModel();
  const res = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  const u = res.usage_metadata || {};
  trackUsage({ inputTokens: u.input_tokens, outputTokens: u.output_tokens });
  return res.content;
}

// Yapisal cevap (Zod semasi). Routing, critic karari, vb. icin.
// mockFactory: mock modda semaya uygun sahte obje uretir.
export async function llmStructured(schema, systemPrompt, userPrompt, mockFactory) {
  if (MOCK_LLM) {
    trackUsage({ inputTokens: estTokens(systemPrompt + userPrompt), outputTokens: 40 });
    return mockFactory();
  }
  const model = await getModel();
  const structured = model.withStructuredOutput(schema);
  const res = await structured.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return res;
}
