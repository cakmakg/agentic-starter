// ── tests/graphState.test.js ─────────────────────────────────────────────
// Die Reducer tragen BEDEUTUNG, nicht nur Mechanik (ADR-0007):
//   • Datenfelder      → ein leeres Schreiben überschreibt nicht
//   • Zähler           → Akkumulator, der Mechanismus des Schutzschalters
//   • Entscheidungen   → der letzte Wert gewinnt, auch wenn er null ist
//
// Verwechselt man sie, bricht nicht die Syntax, sondern die Logik: ein
// akkumulierender isApproved-Wert oder ein überschreibender revisionCount würde
// BREMSE 3 im Orchestrator still aushebeln.
//
// Zugriff über GraphState.spec.<feld>.operator — die Reducer selbst sind
// modulprivat, ihre Wirkung ist über die Annotation prüfbar.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildState } from "../src/kernel/state/schema.js";
import { reportDomain } from "../src/domains/report/domain.js";

import { frischerZustand } from "./helpers/zustand.js";

// Eigenes Zustandsverzeichnis je Testdatei (T11) — sonst sähe der zweite
// `npm test`-Lauf den Zustand des ersten.
frischerZustand();

// Dasselbe Schema wie im Lauf: Kernfelder plus die Felder der Domäne.
const GraphState = buildState(reportDomain);

const feld = (name) => GraphState.spec[name];
const reduziere = (name, alt, neu) => feld(name).operator(alt, neu);
const standard = (name) => feld(name).initialValueFactory();

test("Datenfeld: ein leerer Wert überschreibt den alten NICHT", () => {
  assert.equal(reduziere("draft", "alter Entwurf", ""), "alter Entwurf");
  assert.equal(reduziere("research", "alte Recherche", ""), "alte Recherche");
});

test("Datenfeld: ein gefüllter Wert überschreibt", () => {
  assert.equal(reduziere("draft", "alt", "neu"), "neu");
});

test("Datenfeld: undefined lässt den alten Wert stehen", () => {
  assert.equal(reduziere("draft", "alt", undefined), "alt");
});

test("Zähler: revisionCount akkumuliert — sonst greift BREMSE 3 nie", () => {
  assert.equal(reduziere("revisionCount", 2, 1), 3);
  assert.equal(reduziere("revisionCount", 2, undefined), 2);
  assert.equal(standard("revisionCount"), 0);
});

test("Entscheidungsfeld: der letzte Wert gewinnt — auch null", () => {
  // null ist hier eine Aussage („ungeprüft"), kein fehlender Wert. Genau darauf
  // beruht die Unterscheidung 6a/6b im Orchestrator.
  assert.equal(reduziere("isApproved", true, null), null);
  assert.equal(reduziere("isApproved", null, false), false);
  assert.equal(reduziere("isApproved", true, undefined), true);
});

test("Entscheidungsfeld: humanApproval startet als null (weder ja noch nein)", () => {
  assert.equal(standard("humanApproval"), null);
  assert.equal(standard("isPublished"), false);
  assert.equal(standard("fileSaved"), false);
});

test("Log: wird angehängt, nie ersetzt", () => {
  assert.deepEqual(reduziere("log", ["a"], ["b"]), ["a", "b"]);
  assert.deepEqual(reduziere("log", ["a"], undefined), ["a"]);
  assert.deepEqual(standard("log"), []);
});
