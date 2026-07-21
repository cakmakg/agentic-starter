// ── state/graphState.js ──────────────────────────────────────────────────
// LangGraph durum (state) semasi. Her alanin bir REDUCER'i (delta nasil
// birlesir) ve bir DEFAULT'u var. Reducer secimi ANLAM tasir:
//
//   • Veri alanlari   → "bos yazim mevcut degeri ezmez" (ajan "" donebilir).
//   • Sayaclar        → TOPLAYICI (accumulator). Devre kesici mekanizmasi.
//   • Karar alanlari  → son deger kazanir.
//
// Kurucu Dersi: "Hafiza" tek sey degildir. Bu calisma-ani state, kalici
// artefakt (DB), semantik bilgi (RAG) ve UI state'inden ayridir.

import { Annotation } from "@langchain/langgraph";

// Bos-koru reducer: yeni deger bos degilse yaz, bossa eskiyi tut.
const keepIfFilled = (x, y) => (y !== undefined && y !== "" ? y : x);
// Son-deger reducer.
const lastWins = (x, y) => (y !== undefined ? y : x);
// Toplayici reducer: her delta eklenir (sayac/devre kesici).
const sum = (x, y) => (y !== undefined ? x + y : x);

export const GraphState = Annotation.Root({
  // Girdi
  task: Annotation({ reducer: lastWins, default: () => "" }),
  threadId: Annotation({ reducer: lastWins, default: () => "" }),

  // Uretim izi (research trail) — bos-koru
  research: Annotation({ reducer: keepIfFilled, default: () => "" }),
  draft: Annotation({ reducer: keepIfFilled, default: () => "" }),
  criticFeedback: Annotation({ reducer: keepIfFilled, default: () => "" }),

  // Sayaclar — TOPLAYICI (devre kesici)
  revisionCount: Annotation({ reducer: sum, default: () => 0 }),

  // Karar/bayrak alanlari — son-deger
  nextAgent: Annotation({ reducer: lastWins, default: () => "" }),
  isApproved: Annotation({ reducer: lastWins, default: () => null }),   // critic karari
  fileSaved: Annotation({ reducer: lastWins, default: () => false }),
  humanApproval: Annotation({ reducer: lastWins, default: () => null }), // HITL: true/false/null
  isPublished: Annotation({ reducer: lastWins, default: () => false }),

  // Guvenlik
  threatScore: Annotation({ reducer: lastWins, default: () => 0 }),

  // Gozlemlenebilirlik (UI loglari icin)
  log: Annotation({ reducer: (x, y) => (y ? [...x, ...y] : x), default: () => [] }),
});
