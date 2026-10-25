// ── tests/vertrauenslinie.test.js ────────────────────────────────────────
// Die Vertrauenslinie aus ARCHITECTURE.md §6 (ADR-0031 Teil 3), am Quelltext
// geprüft: die Vertrauensseite importiert nur `node:*`, die Naht start.ts und
// ihre eigenen Dateien; die Agentenseite importiert nichts von der
// Vertrauensseite, nichts von der Außenwelt und nichts aus vendor/. Dazu der
// Code-Teil von M5: auf der Agentenseite steht kein Portalschlüssel und keine
// Variable der Vertrauensseite.
//
// Grenze: eine Prüfung des Quelltexts, keine Prozessgrenze. Dass der Benutzer
// von agentic-starter den Schlüssel nicht lesen und das Portal nicht erreichen
// kann, zeigt erst der WSL2-Lauf (Teil 5).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(import.meta.dirname, "..");
const rel = (p) => path.relative(WURZEL, p).split(path.sep).join("/");

// Die Tabelle aus ARCHITECTURE.md §6.
const VERTRAUENSSEITE = new Set([
  "src/adapters/portal/publishListing.js",
  "src/bin/securityCore.js",
]);
const AUSSENWELT = new Set([
  "src/adapters/portal/fakePortal.js",
  "src/bin/fakePortal.js",
]);
const NAHT = "vendor/security-core/minimal-core/src/core/start.ts";

function dateienUnter(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js"))
    .map((e) => path.join(e.parentPath, e.name));
}

const dateien = dateienUnter(path.join(WURZEL, "src")).map((p) => ({
  datei: rel(p),
  text: fs.readFileSync(p, "utf8"),
}));
const agentenseite = dateien.filter(
  ({ datei }) => !VERTRAUENSSEITE.has(datei) && !AUSSENWELT.has(datei),
);
const vertrauensseite = dateien.filter(({ datei }) =>
  VERTRAUENSSEITE.has(datei),
);

// Statische Importe, Re-Exporte und dynamische Importe mit festem Ziel.
// Relative Ziele werden zum Pfad ab der Repo-Wurzel aufgelöst.
function importe({ datei, text }) {
  const ziele = [];
  for (const muster of [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const [, ziel] of text.matchAll(muster)) {
      ziele.push(
        ziel.startsWith(".")
          ? rel(path.resolve(WURZEL, path.dirname(datei), ziel))
          : ziel,
      );
    }
  }
  return ziele;
}

test("die Prüfung sieht, was sie prüfen soll", () => {
  for (const datei of [...VERTRAUENSSEITE, ...AUSSENWELT, NAHT]) {
    assert.ok(fs.existsSync(path.join(WURZEL, datei)), datei);
  }
  // Ohne diese bekannten Kanten wäre ein leeres Ergebnis kein Nachweis.
  const kern = importe(dateien.find((d) => d.datei === "src/bin/securityCore.js"));
  assert.ok(kern.includes(NAHT));
  assert.ok(kern.includes("src/adapters/portal/publishListing.js"));
  const demo = importe(
    dateien.find((d) => d.datei === "src/bin/demoImmobilien.js"),
  );
  assert.ok(demo.includes("src/adapters/security-core/client.js"));
  assert.ok(agentenseite.length > 30, `nur ${agentenseite.length} Dateien`);
});

test("die Agentenseite importiert nichts von der Vertrauensseite, der Außenwelt oder aus vendor/", () => {
  const verstoesse = [];
  for (const d of agentenseite) {
    for (const ziel of importe(d)) {
      if (
        VERTRAUENSSEITE.has(ziel) ||
        AUSSENWELT.has(ziel) ||
        ziel.startsWith("vendor/") ||
        ziel.includes("security-core/minimal-core")
      ) {
        verstoesse.push(`${d.datei} → ${ziel}`);
      }
    }
  }
  assert.deepEqual(verstoesse, []);
});

test("die Vertrauensseite importiert nur node:*, die Naht start.ts und eigene Dateien", () => {
  const verstoesse = [];
  for (const d of vertrauensseite) {
    for (const ziel of importe(d)) {
      if (
        !ziel.startsWith("node:") &&
        ziel !== NAHT &&
        !VERTRAUENSSEITE.has(ziel)
      ) {
        verstoesse.push(`${d.datei} → ${ziel}`);
      }
    }
  }
  assert.deepEqual(verstoesse, []);
});

test("kein dynamischer Import mit berechnetem Ziel — er entginge dieser Prüfung", () => {
  const treffer = dateien
    .filter(({ text }) => /\bimport\s*\(\s*(?!["'])/.test(text))
    .map(({ datei }) => datei);
  assert.deepEqual(treffer, []);
});

test("M5 (Code): auf der Agentenseite kein Portalschlüssel und keine Variable der Vertrauensseite", () => {
  const verstoesse = [];
  for (const { datei, text } of agentenseite) {
    if (/asp_[0-9a-f]{64}/.test(text)) verstoesse.push(`${datei}: Schlüssel`);
    const variable = text.match(
      /\b(PORTAL_SOCKET|PORTAL_CREDENTIAL_FILE|PORTAL_CREDENTIAL_HASH_FILE)\b/,
    );
    if (variable) verstoesse.push(`${datei}: ${variable[1]}`);
  }
  assert.deepEqual(verstoesse, []);
});
