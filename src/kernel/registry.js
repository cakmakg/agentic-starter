// ── kernel/registry.js ───────────────────────────────────────────────────
// Domänen-Registrierung — Konfiguration, kein Code (ARCHITECTURE.md §6).
//
// Der Kern kennt KEINE einzelne Domäne; er kennt nur diese Registry. Das ist
// die Stelle, an der das Prüfkriterium aus ADR-0018 hängt: eine zweite Domäne
// kommt hier als Eintrag hinzu und ändert sonst null Zeilen im Kern (T10).
//
// Ein Eintrag in einer Registry ist Konfiguration, kein Kernwissen — deshalb
// zählt er beim Prüfkriterium nicht mit.

import { createRunner } from "./graph/runner.js";

const specs = new Map();
const runners = new Map();

const PFLICHTFELDER = ["name", "nodes", "entry", "hub", "spokes", "terminal"];

export function registerDomain(spec) {
  for (const feld of PFLICHTFELDER) {
    if (spec?.[feld] === undefined) {
      throw new Error(
        `registerDomain: Feld "${feld}" fehlt in der Spezifikation.`,
      );
    }
  }
  for (const knoten of [spec.entry, spec.hub, spec.terminal, ...spec.spokes]) {
    if (typeof spec.nodes[knoten] !== "function") {
      throw new Error(
        `registerDomain: Domäne "${spec.name}" nennt den Knoten "${knoten}", liefert aber keine Funktion dafür.`,
      );
    }
  }
  specs.set(spec.name, spec);
  return spec;
}

export function getDomain(name) {
  const spec = specs.get(name);
  if (!spec) {
    throw new Error(
      `getDomain: Domäne "${name}" ist nicht registriert (bekannt: ${listDomains().join(", ") || "keine"}).`,
    );
  }
  return spec;
}

// Ein Runner je Domäne. Der Checkpointer lebt im Arbeitsspeicher; zwei Runner
// derselben Domäne hätten getrennte Zustände und die Genehmigung liefe ins Leere.
export function getRunner(name) {
  if (!runners.has(name)) runners.set(name, createRunner(getDomain(name)));
  return runners.get(name);
}

export function listDomains() {
  return [...specs.keys()];
}
