// ── workflow/graph.js ────────────────────────────────────────────────────
// Orkestrasyon grafi (LangGraph StateGraph). HUB-AND-SPOKE topolojisi:
// her ajan orchestrator'a geri doner; orchestrator koşullu kenarla siradakini secer.
//
//   START → guardrail → orchestrator ⇄ {researcher, writer, critic, fileSaver}
//                              ⛔ interruptBefore: human_approval  (graf burada DURUR)
//                              → (onaydan sonra) publisher → END
//
// Kurucu Dersi: Yonlendirme zekasi KENARLARDA degil, orchestrator dugumunde.
// Kenar sadece "state.nextAgent neyse oraya git" der. Tek nokta = denetlenebilir.

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { GraphState } from "../state/graphState.js";
import { guardrailNode } from "../agents/guardrail.js";
import { orchestratorNode } from "../agents/orchestrator.js";
import { researcherNode } from "../agents/researcher.js";
import { writerNode } from "../agents/writer.js";
import { criticNode } from "../agents/critic.js";
import { fileSaverNode } from "../agents/fileSaver.js";
import { publisherNode } from "../agents/publisher.js";

// human_approval = BOS placeholder. Tek islevi: grafin duracagi noktayi isaretlemek.
const humanNode = () => ({});

export function buildGraph() {
  const g = new StateGraph(GraphState)
    .addNode("guardrail", guardrailNode)
    .addNode("orchestrator", orchestratorNode)
    .addNode("researcher", researcherNode)
    .addNode("writer", writerNode)
    .addNode("critic", criticNode)
    .addNode("fileSaver", fileSaverNode)
    .addNode("human_approval", humanNode)
    .addNode("publisher", publisherNode);

  g.addEdge(START, "guardrail");

  // guardrail → ya END (tehdit) ya orchestrator. Kosullu.
  g.addConditionalEdges("guardrail", (s) => (s.nextAgent === "END" ? END : "orchestrator"));

  // ORCHESTRATOR ÇIKIŞI: statik degil, KOSULLU. state.nextAgent dogrudan dugum adi.
  g.addConditionalEdges("orchestrator", (s) => (s.nextAgent === "END" ? END : s.nextAgent), {
    researcher: "researcher",
    writer: "writer",
    critic: "critic",
    fileSaver: "fileSaver",
    human_approval: "human_approval",
    [END]: END,
  });

  // Her uretici ajan hub'a (orchestrator) geri doner.
  g.addEdge("researcher", "orchestrator");
  g.addEdge("writer", "orchestrator");
  g.addEdge("critic", "orchestrator");
  g.addEdge("fileSaver", "orchestrator");
  // human_approval'dan sonra publisher (graf resume edilince).
  g.addEdge("human_approval", "publisher");
  g.addEdge("publisher", END);

  // MemorySaver = pause/resume icin checkpointer (bellek-ici).
  // interruptBefore: graf human_approval'a girmeden ONCE durur → HITL.
  return g.compile({
    checkpointer: new MemorySaver(),
    interruptBefore: ["human_approval"],
  });
}
