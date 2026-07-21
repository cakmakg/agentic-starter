// ── security/auth.js ─────────────────────────────────────────────────────
// MOAT Layer 3 — Kimlik dogrulama. FAIL-CLOSED.
//
// Kurallar (referans sistemden):
//  • API key SADECE x-api-key header'indan okunur (body/query'den DEGIL —
//    "key smuggling" onlenir).
//  • Sanitize: sadece [a-zA-Z0-9-_.], max 128 char.
//  • Bilinmeyen key → 401 (otomatik tenant olusturma YOK).

import { env } from "../config/env.js";

function sanitizeApiKey(k) {
  return String(k || "").replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 128);
}

export function authMiddleware(req, res, next) {
  const key = sanitizeApiKey(req.header("x-api-key"));
  if (!key || key !== env.apiKey) {
    return res.status(401).json({ error: "gecersiz veya eksik x-api-key" });
  }
  req.clientId = key; // downstream buna guvenir
  next();
}
