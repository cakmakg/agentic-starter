// ── security/actionQueue.js ──────────────────────────────────────────────
// MOAT Layer 4 — AKSIYON IZOLASYONU. Sistemin en onemli guvenlik deseni.
//
//   Ajan → ActionQueue (sadece YAZAR) → Worker (okur + DOGRULAR + yurutur)
//
// Iki kapi:
//   1) enqueueAction: actionType whitelist'te degilse DB'ye yazimdan ONCE reddet.
//   2) Worker: payload'i sema+uzunluk dogrular, hard timeout, N deneme sonra FAILED.
//
// Boylece ele gecirilmis bir ajan bile sadece whitelist'li, sinirli aksiyon
// kuyruga atabilir — dogrudan dis dunyaya erisemez.

// İzin verilen aksiyon tipleri (cift kapi: hem burada hem sema enum'unda).
const WHITELIST = new Set(["NOTIFY", "WEBHOOK", "EMAIL"]);

// Payload dogrulayicilar — her tip icin sema + uzunluk siniri.
const VALIDATORS = {
  NOTIFY: (p) => typeof p.text === "string" && p.text.length <= 1000,
  WEBHOOK: (p) => typeof p.url === "string" && p.url.startsWith("https://"),
  EMAIL: (p) => typeof p.to === "string" && p.to.includes("@") && (p.body || "").length <= 5000,
};

const queue = []; // { id, threadId, actionType, payload, status, attempts }
let _id = 0;

export function enqueueAction({ threadId, actionType, payload }) {
  // KAPI 1: whitelist disi → DB'ye yazma bile.
  if (!WHITELIST.has(actionType)) {
    throw new Error(`actionType whitelist'te degil: ${actionType}`);
  }
  const action = { id: ++_id, threadId, actionType, payload, status: "PENDING", attempts: 0 };
  queue.push(action);
  return action.id;
}

// Worker: periyodik calisir. Atomik claim → dogrula → yurut → retry/fail.
async function processOne(action) {
  action.status = "PROCESSING";
  action.attempts++;

  // KAPI 2: payload dogrulama.
  const ok = VALIDATORS[action.actionType]?.(action.payload);
  if (!ok) {
    action.status = "REJECTED";
    return;
  }

  try {
    // Gercek dis cagri BURADA olur (fetch + hard timeout). Starter'da simule.
    // await fetch(...);
    action.status = "DONE";
  } catch {
    if (action.attempts >= 3) action.status = "FAILED";
    else action.status = "PENDING"; // tekrar denenecek
  }
}

let timer = null;
export function startActionWorker(intervalMs = 5000) {
  if (timer) return;
  timer = setInterval(async () => {
    const pending = queue.filter((a) => a.status === "PENDING");
    for (const a of pending) await processOne(a);
  }, intervalMs);
  timer.unref?.();
}
export function stopActionWorker() { clearInterval(timer); timer = null; }
export function getQueue() { return queue.slice(); }
