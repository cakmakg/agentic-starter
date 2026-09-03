// ── tests/orchestrator.test.js ───────────────────────────────────────────
// Die sieben deterministischen Bremsen, jede einzeln. Sie lösen 90 % der
// Routing-Fälle ohne LLM-Kosten; brechen sie, wird das System teuer UND
// nichtdeterministisch (Metrik 3.3 Loop-Termination, 3.4 Routing-Determinismus).
//
// Der Kern liegt in 6a gegen 6b: `null` heißt „ungeprüft", `false` heißt
// „abgelehnt". Beides gleich zu behandeln war der blockierende Defekt aus
// Phase 0 — der critic rief sich endlos selbst auf, bis GraphRecursionError.

import { test, before } from "node:test";
import assert from "node:assert/strict";

import { MOCK_LLM } from "../src/kernel/config/env.js";
import { orchestratorNode } from "../src/domains/report/domain.js";

// Ein Zustand, in dem KEINE Bremse greift, als Ausgangspunkt zum Verbiegen.
const zustand = (over = {}) => ({
  task: "Aufgabe",
  research: "",
  draft: "",
  criticFeedback: "",
  revisionCount: 0,
  isApproved: null,
  fileSaved: false,
  humanApproval: null,
  isPublished: false,
  ...over,
});

before(() => {
  assert.equal(
    MOCK_LLM,
    true,
    "Diese Tests laufen nur im Mock-Modus. ANTHROPIC_API_KEY ist gesetzt — bitte für den Testlauf entfernen.",
  );
});

test("BREMSE 1: veröffentlicht → END", async () => {
  const r = await orchestratorNode(zustand({ isPublished: true }));
  assert.equal(r.nextAgent, "END");
});

test("BREMSE 2: Datei gespeichert, keine menschliche Entscheidung → human_approval", async () => {
  const r = await orchestratorNode(
    zustand({ fileSaved: true, humanApproval: null }),
  );
  assert.equal(r.nextAgent, "human_approval");
});

test("BREMSE 2 geht der Datenlogik VOR: auch ohne Recherche zum Menschen", async () => {
  // Reihenfolge ist Bedeutung: die HITL-Entscheidung wird niemals dem LLM
  // überlassen und niemals von einer späteren Bremse überholt.
  const r = await orchestratorNode(
    zustand({ fileSaved: true, research: "", draft: "" }),
  );
  assert.equal(r.nextAgent, "human_approval");
});

test("BREMSE 3: Revisionslimit erreicht → human_approval (Schutzschalter)", async () => {
  const r = await orchestratorNode(
    zustand({ revisionCount: 5, research: "da", draft: "da" }),
  );
  assert.equal(r.nextAgent, "human_approval");
  assert.match(r.log[0], /BREMSE3/);
});

test("BREMSE 4: keine Recherche → researcher", async () => {
  const r = await orchestratorNode(zustand());
  assert.equal(r.nextAgent, "researcher");
});

test("BREMSE 5: Recherche da, kein Entwurf → writer", async () => {
  const r = await orchestratorNode(zustand({ research: "da" }));
  assert.equal(r.nextAgent, "writer");
});

test("BREMSE 6a: Entwurf UNGEPRÜFT (null) → critic", async () => {
  const r = await orchestratorNode(
    zustand({ research: "da", draft: "da", isApproved: null }),
  );
  assert.equal(r.nextAgent, "critic");
});

test("BREMSE 6b: Entwurf ABGELEHNT (false) → writer, nicht critic", async () => {
  // Der eigentliche Defekt aus Phase 0. Ginge es hier zum critic, entstünde
  // wieder die Endlosschleife.
  const r = await orchestratorNode(
    zustand({ research: "da", draft: "da", isApproved: false }),
  );
  assert.equal(r.nextAgent, "writer");
  assert.match(r.log[0], /BREMSE6b/);
});

test("BREMSE 7: freigegeben und noch nicht gespeichert → fileSaver", async () => {
  const r = await orchestratorNode(
    zustand({ research: "da", draft: "da", isApproved: true }),
  );
  assert.equal(r.nextAgent, "fileSaver");
});

test("SCHICHT 2: greift keine Bremse, entscheidet das LLM — im Mock sicher END", async () => {
  // Alle Bremsen umgangen: gespeichert, menschlich entschieden, freigegeben.
  const r = await orchestratorNode(
    zustand({
      research: "da",
      draft: "da",
      isApproved: true,
      fileSaved: true,
      humanApproval: true,
    }),
  );
  assert.equal(r.nextAgent, "END");
  assert.match(r.log[0], /LLM-Routing/);
});

// Nicht abgedeckt: SCHICHT 3 (Override eines ungültigen Agenten). Sie ist nur
// erreichbar, wenn ein echtes Modell einen Agenten außerhalb des Enums liefert;
// im Mock-Modus erzwingt der mockFactory bereits ein gültiges END. Diese Lücke
// gehört zu Schicht B (EVALS.md §2), nicht hierher.
