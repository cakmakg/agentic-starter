// ── domains/report/domain.js ─────────────────────────────────────────────
// Die Spezifikation der Domäne `report`. Hier steht die BEDEUTUNG: welche
// Agenten es gibt, in welcher REIHENFOLGE die Bremsen greifen, welche MUSTER
// als Bedrohung gelten, welche Felder der State zusätzlich trägt.
//
// Der Kern kennt diese Datei nicht — er kennt nur die Registry (ADR-0018).
// Eine zweite Domäne entsteht als Geschwisterdatei und ändert null Zeilen im
// Kern; genau das misst T10 in Phase 5.

import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

import { registerDomain } from "../../kernel/registry.js";
import { createRouter } from "../../kernel/graph/routing.js";
import { createGuardrail } from "../../kernel/security/guardrail.js";
import { keepIfFilled, lastWins } from "../../kernel/state/reducers.js";
import { llmStructured } from "../../kernel/llm/adapter.js";

import { prompts } from "./prompts.js";
import { researcherNode } from "./agents/researcher.js";
import { writerNode } from "./agents/writer.js";
import { criticNode } from "./agents/critic.js";
import { fileSaverNode } from "./agents/fileSaver.js";
import { publisherNode } from "./agents/publisher.js";

const MAX_REVISIONS = 5; // harter Schutzschalter
const MAX_TASK_LENGTH = 3000;

// ── Zusätzliche State-Felder dieser Domäne ───────────────────────────────
// Die Wahl des Reducers trägt Bedeutung (ADR-0007): Datenfelder mit Leer-Schutz,
// Entscheidungsfelder mit "letzter Wert gewinnt".
const stateFields = {
  research: Annotation({ reducer: keepIfFilled, default: () => "" }),
  draft: Annotation({ reducer: keepIfFilled, default: () => "" }),
  criticFeedback: Annotation({ reducer: keepIfFilled, default: () => "" }),
  isApproved: Annotation({ reducer: lastWins, default: () => null }), // Entscheidung des Critic
  fileSaved: Annotation({ reducer: lastWins, default: () => false }),
  isPublished: Annotation({ reducer: lastWins, default: () => false }),
};

// ── Die Bremsen, in dieser Reihenfolge ───────────────────────────────────
// Die Reihenfolge IST die Aussage. Bremse 2 steht vor jeder Datenlogik, damit
// die HITL-Entscheidung niemals von einer späteren Regel überholt wird.
const brakes = [
  // 1: Ist veröffentlicht, dann Schluss (nach der Veröffentlichung nicht
  //    erneut in die Schleife laufen).
  (s) =>
    s.isPublished
      ? { nextAgent: "END", log: ["🧠 BREMSE1: veröffentlicht → END"] }
      : null,

  // 2: Datei gespeichert, aber keine menschliche Entscheidung → HITL.
  //    Überlass die HITL-Entscheidung NIEMALS dem LLM.
  (s) =>
    s.fileSaved && s.humanApproval == null
      ? {
          nextAgent: "human_approval",
          log: ["🧠 BREMSE2: Datei bereit → menschliche Genehmigung"],
        }
      : null,

  // 3: Zu viele Revisionen → hart abbrechen und an den Menschen geben.
  //    Seit T2.2 greift sie wirklich: BREMSE 6b führt nach einer Ablehnung
  //    zum writer zurück, und dort wächst revisionCount.
  (s) =>
    s.revisionCount >= MAX_REVISIONS
      ? {
          nextAgent: "human_approval",
          log: [
            `🧠 BREMSE3: Revisionslimit (${s.revisionCount}) → menschliche Genehmigung`,
          ],
        }
      : null,

  // 4: Ohne Recherche zuerst recherchieren.
  (s) =>
    !s.research
      ? {
          nextAgent: "researcher",
          log: ["🧠 BREMSE4: keine Recherche → researcher"],
        }
      : null,

  // 5: Recherche da, aber kein Entwurf → schreiben.
  (s) =>
    s.research && !s.draft
      ? {
          nextAgent: "writer",
          log: ["🧠 BREMSE5: Recherche da, kein Entwurf → writer"],
        }
      : null,

  // 6a: Entwurf da, aber noch nicht geprüft → critic.
  //     Die Unterscheidung zu 6b ist der Kern: null heißt "ungeprüft", false
  //     heißt "abgelehnt". Beides gleich zu behandeln war der blockierende
  //     Defekt aus Phase 0 — der critic rief sich endlos selbst auf.
  (s) =>
    s.draft && s.isApproved == null
      ? {
          nextAgent: "critic",
          log: ["🧠 BREMSE6a: Entwurf ungeprüft → critic"],
        }
      : null,

  // 6b: Entwurf abgelehnt → zurück zum writer. Das ist die Revisionsschleife;
  //     erst dadurch wächst revisionCount und BREMSE 3 greift.
  (s) =>
    s.draft && s.isApproved === false
      ? {
          nextAgent: "writer",
          log: ["🧠 BREMSE6b: abgelehnt → writer (Revision)"],
        }
      : null,

  // 7: Ist der Entwurf freigegeben, speichern.
  (s) =>
    s.draft && s.isApproved === true && !s.fileSaved
      ? { nextAgent: "fileSaver", log: ["🧠 BREMSE7: freigegeben → fileSaver"] }
      : null,
];

const validAgents = [
  "researcher",
  "writer",
  "critic",
  "fileSaver",
  "human_approval",
  "END",
];

const routingSchema = z.object({
  nextAgent: z.enum(["researcher", "writer", "critic", "fileSaver", "END"]),
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
// Gewichtete Bewertung; die Stufe entspricht dem Schweregrad.
//
// 🔴 Bekannter Defekt (in Phase 3 gemessen): die Summe aller Gewichte ist 8 und
// die Blockierschwelle liegt ebenfalls bei 8 — blockiert wird also nur, wenn
// ALLE vier Regeln gleichzeitig greifen. `tests/guardrail.test.js` hält das als
// `todo`-Test offen, statt das Verhalten zuzusichern.
const guardrailRules = [
  {
    w: 3,
    re: /ignore (previous|all) instructions|jailbreak|DAN mode|<\/?system>/i,
  },
  { w: 2, re: /you are now (a|an)|pretend to be|act as (a|an)/i },
  { w: 2, re: /\[INST\]|###\s*system|<\|.*?\|>/i },
  { w: 1, re: /malware|sql injection|xss|drop table/i },
];

export const reportDomain = registerDomain({
  name: "report",
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
    researcher: researcherNode,
    writer: writerNode,
    critic: criticNode,
    fileSaver: fileSaverNode,
    publisher: publisherNode,
  },
  entry: "guardrail",
  hub: "orchestrator",
  spokes: ["researcher", "writer", "critic", "fileSaver"],
  terminal: "publisher",
});

// Für Tests und Evaluationen: die Bausteine einzeln prüfbar halten.
export const guardrailNode = reportDomain.nodes.guardrail;
export const orchestratorNode = reportDomain.nodes.orchestrator;
export { brakes, validAgents, guardrailRules, MAX_REVISIONS, stateFields };
