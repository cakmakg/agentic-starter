// ── domains/immobilien/domain.js ─────────────────────────────────────────
// Die Spezifikation der Domäne `immobilien` (Phase 5, ADR-0024, vorgezogen
// aus Phase 4). Zweite Domäne im Sinne von ADR-0018 — sie entsteht als
// Geschwisterdatei zu domains/report/domain.js und ändert NULL Zeilen im
// Kern. Genau das misst T10.
//
// Ablauf: guardrail → orchestrator ⇄ {portfolioLoader, listingWriter,
// contractChecker, listingStore} → human_approval → delivery → END.

import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

import { registerDomain } from "../../kernel/registry.js";
import { createRouter } from "../../kernel/graph/routing.js";
import { createGuardrail } from "../../kernel/security/guardrail.js";
import { lastWins, keepIfFilled } from "../../kernel/state/reducers.js";
import { llmStructured } from "../../kernel/llm/adapter.js";

import { prompts } from "./prompts.js";
import { portfolioLoaderNode } from "./agents/portfolioLoader.js";
import { listingWriterNode, TARGET_PORTALS } from "./agents/listingWriter.js";
import { contractCheckerNode } from "./agents/contractChecker.js";
import { listingStoreNode } from "./agents/listingStore.js";
import { deliveryNode } from "./agents/delivery.js";

const MAX_REVISIONS = 5; // harter Schutzschalter
const MAX_TASK_LENGTH = 3000;

// ── Zusätzliche State-Felder dieser Domäne ───────────────────────────────
const stateFields = {
  property: Annotation({ reducer: lastWins, default: () => null }),
  listings: Annotation({ reducer: lastWins, default: () => ({}) }),
  isContractValid: Annotation({ reducer: lastWins, default: () => null }),
  contractFeedback: Annotation({ reducer: keepIfFilled, default: () => "" }),
  staged: Annotation({ reducer: lastWins, default: () => false }),
  isDelivered: Annotation({ reducer: lastWins, default: () => false }),
};

// ── Die Bremsen, in dieser Reihenfolge (Struktur wie domains/report) ────
const brakes = [
  // 1: Ausgeliefert, dann Schluss.
  (s) =>
    s.isDelivered
      ? { nextAgent: "END", log: ["🧠 BREMSE1: ausgeliefert → END"] }
      : null,

  // 2: Inserate gespeichert, aber keine menschliche Entscheidung → HITL.
  (s) =>
    s.staged && s.humanApproval == null
      ? {
          nextAgent: "human_approval",
          log: ["🧠 BREMSE2: Inserate bereit → menschliche Genehmigung"],
        }
      : null,

  // 3: Zu viele Revisionen → hart abbrechen und an den Menschen geben.
  (s) =>
    s.revisionCount >= MAX_REVISIONS
      ? {
          nextAgent: "human_approval",
          log: [
            `🧠 BREMSE3: Revisionslimit (${s.revisionCount}) → menschliche Genehmigung`,
          ],
        }
      : null,

  // 4: Kein Objekt geladen → laden.
  (s) =>
    !s.property
      ? {
          nextAgent: "portfolioLoader",
          log: ["🧠 BREMSE4: kein Objekt geladen → portfolioLoader"],
        }
      : null,

  // 5: Objekt da, aber noch nicht für jedes Portal ein Inserat → schreiben.
  (s) =>
    s.property && Object.keys(s.listings).length < TARGET_PORTALS.length
      ? {
          nextAgent: "listingWriter",
          log: ["🧠 BREMSE5: Portale offen → listingWriter"],
        }
      : null,

  // 6a: Alle Portale geschrieben, aber ungeprüft → contractChecker.
  (s) =>
    Object.keys(s.listings).length === TARGET_PORTALS.length &&
    s.isContractValid == null
      ? {
          nextAgent: "contractChecker",
          log: ["🧠 BREMSE6a: Inserate ungeprüft → contractChecker"],
        }
      : null,

  // 6b: Vertrag verletzt → zurück zum listingWriter (Revisionsschleife).
  (s) =>
    s.isContractValid === false
      ? {
          nextAgent: "listingWriter",
          log: ["🧠 BREMSE6b: Vertrag verletzt → listingWriter (Revision)"],
        }
      : null,

  // 7: Vertrag erfüllt, aber noch nicht gespeichert → speichern.
  (s) =>
    s.isContractValid === true && !s.staged
      ? {
          nextAgent: "listingStore",
          log: ["🧠 BREMSE7: Vertrag erfüllt → listingStore"],
        }
      : null,
];

const validAgents = [
  "portfolioLoader",
  "listingWriter",
  "contractChecker",
  "listingStore",
  "human_approval",
  "END",
];

const routingSchema = z.object({
  nextAgent: z.enum([
    "portfolioLoader",
    "listingWriter",
    "contractChecker",
    "listingStore",
    "END",
  ]),
  reason: z.string(),
});

// Schicht 2 des Routings: nur erreichbar, wenn keine Bremse greift.
const llmRouter = (state) =>
  llmStructured(
    routingSchema,
    prompts.router.system,
    prompts.router.user(state),
    () => ({
      nextAgent: "END",
      reason: "mock: Zustand außerhalb der Bremsen, sicheres END",
    }),
  );

// ── Guardrail-Muster ─────────────────────────────────────────────────────
// Eigene Kopie wie in domains/report/domain.js (ADR-0018: die Domäne bringt
// ihre Muster mit, der Kern nur die Regex-Engine).
const guardrailRules = [
  {
    w: 3,
    re: /ignore (previous|all) instructions|jailbreak|DAN mode|<\/?system>/i,
  },
  { w: 2, re: /you are now (a|an)|pretend to be|act as (a|an)/i },
  { w: 2, re: /\[INST\]|###\s*system|<\|.*?\|>/i },
  { w: 1, re: /malware|sql injection|xss|drop table/i },
];

export const immobilienDomain = registerDomain({
  name: "immobilien",
  stateFields,
  nodes: {
    guardrail: createGuardrail({
      rules: guardrailRules,
      blockThreshold: 8,
      sanitizeThreshold: 3,
      sanitize: (task) =>
        task.replace(/ignore (previous|all) instructions/gi, "[filtered]"),
      maxTaskLength: MAX_TASK_LENGTH,
    }),
    orchestrator: createRouter({ brakes, validAgents, llmRouter }),
    portfolioLoader: portfolioLoaderNode,
    listingWriter: listingWriterNode,
    contractChecker: contractCheckerNode,
    listingStore: listingStoreNode,
    delivery: deliveryNode,
  },
  entry: "guardrail",
  hub: "orchestrator",
  spokes: [
    "portfolioLoader",
    "listingWriter",
    "contractChecker",
    "listingStore",
  ],
  terminal: "delivery",
});

export {
  brakes,
  validAgents,
  guardrailRules,
  MAX_REVISIONS,
  stateFields,
  TARGET_PORTALS,
};
