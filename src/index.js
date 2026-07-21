// ── index.js ─────────────────────────────────────────────────────────────
// HTTP katmani. Middleware boru hatti = MOAT'in kurulus sirasi:
//
//   express.json(limit) → [auth] → rate limiters → routes
//
// Endpoint'ler:
//   POST /api/run        → workflow baslat (auth + workflowLimiter)
//   GET  /api/events/:id → SSE canli akis (event buffering ile)
//   POST /api/approve    → HITL karari (auth + approveLimiter)
//   GET  /api/artifact/:id → reload sonrasi icerik fallback
//   GET  /api/queue      → action queue durumu (gozlem)

import express from "express";
import crypto from "node:crypto";
import { env } from "./config/env.js";
import { authMiddleware } from "./security/auth.js";
import { globalLimiter, workflowLimiter, approveLimiter } from "./security/rateLimiter.js";
import { startWorkflow, resolveApproval } from "./workflow/runner.js";
import { agentEventBus, drainBuffer } from "./lib/eventBus.js";
import { getArtifact } from "./agents/fileSaver.js";
import { getQueue, startActionWorker } from "./security/actionQueue.js";

const app = express();
app.use(express.json({ limit: "2mb" })); // govde boyutu siniri = DoS onlemi
app.use("/api", globalLimiter);

// SSE: auth'tan once (EventSource header gonderemez); thread_id tahmin edilemez (uuid).
app.get("/api/events/:threadId", (req, res) => {
  const { threadId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  drainBuffer(threadId, send);          // once tamponu boşalt
  agentEventBus.on(threadId, send);     // sonra canli dinle
  req.on("close", () => agentEventBus.off(threadId, send));
});

// Workflow baslat.
app.post("/api/run", authMiddleware, workflowLimiter, async (req, res) => {
  const task = String(req.body?.task || "").trim();
  if (!task) return res.status(400).json({ error: "task gerekli" });
  const threadId = crypto.randomUUID();
  res.json({ threadId }); // hemen don; ilerleme SSE'den akar
  startWorkflow({ task, threadId }).catch((e) =>
    console.error("workflow hata:", e.message),
  );
});

// HITL karari.
app.post("/api/approve", authMiddleware, approveLimiter, async (req, res) => {
  const { threadId, approved } = req.body || {};
  if (!threadId) return res.status(400).json({ error: "threadId gerekli" });
  res.json({ ok: true });
  resolveApproval({ threadId, approved: Boolean(approved) }).catch((e) =>
    console.error("approve hata:", e.message),
  );
});

app.get("/api/artifact/:threadId", authMiddleware, (req, res) => {
  res.json(getArtifact(req.params.threadId) || { error: "yok" });
});
app.get("/api/queue", authMiddleware, (req, res) => res.json(getQueue()));

startActionWorker();
app.listen(env.port, () =>
  console.log(`agentic-starter calisiyor → http://localhost:${env.port}  (LLM: ${env.anthropicKey ? "gercek" : "MOCK"})`),
);

export { app };
