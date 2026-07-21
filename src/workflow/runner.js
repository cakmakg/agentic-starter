// ── workflow/runner.js ───────────────────────────────────────────────────
// Grafi calistiran katman. Iki sorumluluk:
//   1) Stream et + her dugum gecisinde SSE event yay (gozlemlenebilirlik).
//   2) HITL koprusu: graf human_approval'da durunca break et; onay gelince
//      ayni thread_id ile checkpoint'ten DEVAM et.
//
// Kurucu Dersi (HITL): Bu, IKI HTTP istegi arasinda yasayan bir state machine.
// 1. istek workflow'u baslatir ve "__interrupt__"ta durur. 2. istek (onay)
// ayni thread_id ile checkpoint'i gunceller ve devam ettirir. Sir: AYNI thread_id.

import { buildGraph } from "./graph.js";
import { emitToThread, scheduleBufferGc } from "../lib/eventBus.js";

const app = buildGraph();

// Bir workflow baslat. human_approval'a kadar kosar, orada durur.
export async function startWorkflow({ task, threadId }) {
  const config = { configurable: { thread_id: threadId } };
  let interrupted = false;

  // stream: her dugum bittiginde bir "update" gelir.
  for await (const step of await app.stream({ task, threadId }, config)) {
    for (const [node, update] of Object.entries(step)) {
      (update.log || []).forEach((line) => emitToThread(threadId, { type: "agent_log", node, line }));
      emitToThread(threadId, { type: "agent_active", node });
    }
  }

  // Durdu mu? state'i kontrol et.
  const snap = await app.getState(config);
  if (snap.next && snap.next.includes("human_approval")) {
    interrupted = true;
    emitToThread(threadId, { type: "workflow_complete", status: "AWAITING_APPROVAL" });
  } else {
    emitToThread(threadId, { type: "workflow_complete", status: "DONE" });
  }
  scheduleBufferGc(threadId);
  return { interrupted };
}

// HITL kararini uygula ve devam ettir.
export async function resolveApproval({ threadId, approved }) {
  const config = { configurable: { thread_id: threadId } };
  // Insan kararini checkpoint'e yaz.
  await app.updateState(config, { humanApproval: approved });

  if (!approved) {
    // RED → revizyon: writer'a geri don (criticFeedback ile).
    await app.updateState(config, { isApproved: false, criticFeedback: "Insan reddetti, gozden gecir." });
  }

  // null ile stream = checkpoint'ten DEVAM et.
  for await (const step of await app.stream(null, config)) {
    for (const [node, update] of Object.entries(step)) {
      (update.log || []).forEach((line) => emitToThread(threadId, { type: "agent_log", node, line }));
      emitToThread(threadId, { type: "agent_active", node });
    }
  }
  emitToThread(threadId, { type: "workflow_complete", status: approved ? "PUBLISHED" : "REVISED" });
}
