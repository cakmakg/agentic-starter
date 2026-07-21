// ── lib/eventBus.js ──────────────────────────────────────────────────────
// Canli akis (SSE) icin olay otobusu + EVENT BUFFERING.
//
// Kurucu Dersi: Async sistemde yaris kosulu (race condition) varsayilan haldir.
// Workflow cogu zaman tarayici SSE baglantisini acmadan ONCE event uretmeye
// baslar. Bu event'leri kaybetmemek icin: dinleyici yoksa tampona koy,
// dinleyici baglaninca sirayla oynat.

import { EventEmitter } from "node:events";

export const agentEventBus = new EventEmitter();
agentEventBus.setMaxListeners(0);

// threadId -> bekleyen event[]  (dinleyici baglanmadan once uretilenler)
const buffers = new Map();

export function emitToThread(threadId, event) {
  const payload = { ...event, ts: Date.now() };
  if (agentEventBus.listenerCount(threadId) === 0) {
    // Dinleyici yok → tampona koy.
    if (!buffers.has(threadId)) buffers.set(threadId, []);
    buffers.get(threadId).push(payload);
  } else {
    // Dinleyici var → canli yayinla.
    agentEventBus.emit(threadId, payload);
  }
}

// SSE baglantisi acildiginda: once tamponu boşalt, sonra canli dinle.
export function drainBuffer(threadId, listener) {
  const pending = buffers.get(threadId) || [];
  for (const ev of pending) listener(ev);
  buffers.delete(threadId);
}

// 5 dk sonra hic baglanilmayan tamponlari topla (bellek sizinti onleme).
export function scheduleBufferGc(threadId) {
  setTimeout(() => buffers.delete(threadId), 5 * 60 * 1000);
}
