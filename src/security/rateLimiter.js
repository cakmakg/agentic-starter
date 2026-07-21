// ── security/rateLimiter.js ──────────────────────────────────────────────
// MOAT Layer 2 — Rate limiting. Endpoint kademeli: pahali LLM endpoint'leri
// daha sIki limitlenir.
//
// Kurucu Dersi: Tek bir global limit yetmez. "Pahali" (LLM cagiran) ve "ucuz"
// (sadece okuyan) endpoint'leri ayri kovalara koy.

import rateLimit from "express-rate-limit";

const make = (max) =>
  rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.clientId || req.ip, // tenant varsa tenant, yoksa IP
    message: { error: "rate limit asildi" },
  });

export const globalLimiter = make(120);   // baseline
export const workflowLimiter = make(10);   // pahali LLM akisi
export const approveLimiter = make(20);    // onay kapisi
