// ── agents/publisher.js ──────────────────────────────────────────────────
// Yayin/dagitim ajani. AMA dikkat — MOAT'in cekirdek prensibi:
//
//   AJANLAR DIS API'LERI ASLA DOGRUDAN CAGIRMAZ.
//
// Publisher sadece ActionQueue'ya YAZAR. Gercek dis cagriyi (Telegram, e-posta,
// sosyal medya) ayri bir worker, dogrulama yaparak yurutur.
//
// Kurucu Dersi: Ele gecirilmis/halusinasyon goren bir ajan, veri sizdiramaz
// veya spam yapamaz — sadece whitelist'li, sema-sinirli aksiyonlari kuyruga atar.

import { enqueueAction } from "../security/actionQueue.js";
import { markPublished } from "./fileSaver.js";

export function publisherNode(state) {
  // Dogrudan fetch YOK — sadece kuyruga yaz.
  enqueueAction({
    threadId: state.threadId,
    actionType: "NOTIFY", // whitelist'te olmali, yoksa kuyruk reddeder
    payload: { text: `Yeni rapor hazir: ${state.task}` },
  });
  markPublished(state.threadId);

  return {
    isPublished: true,
    nextAgent: "END",
    log: ["📡 publisher: aksiyon kuyruga eklendi (worker dogrulayip yurutecek)"],
  };
}
