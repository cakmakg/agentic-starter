// ── tests/kernPin.test.js ────────────────────────────────────────────────
// M6 (docs/kern-integration.md): der benutzte Security Core ist genau der
// gepinnte und unverändert (ADR-0031 Teil 2; CC-2, CC-4 im Kernvertrag).
//
// Geprüft wird zweimal der Hash: im Index des Repos (was committet ist) und
// im ausgecheckten Submodul (was tatsächlich läuft). Ein Pin, der nur im
// Index stimmt, sagte nichts über den Code, den ein Prozess lädt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PIN = "157bdad8583b4a494643103ed9fcef8e89fe3b53"; // adapter-seam-v1
const WURZEL = path.resolve(import.meta.dirname, "..");
const SUBMODUL = path.join(WURZEL, "vendor", "security-core");
const NAHT = path.join(SUBMODUL, "minimal-core", "src", "core", "start.ts");

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

test("das Submodul ist ausgecheckt — sonst prüft dieser Test nichts", () => {
  assert.ok(
    existsSync(NAHT),
    "vendor/security-core fehlt: git submodule update --init",
  );
});

test("der Index pinnt das Submodul auf adapter-seam-v1", () => {
  // Format: <modus> <hash> <stufe>\t<pfad>; 160000 = Gitlink.
  const [modus, hash] = git(
    WURZEL,
    "ls-files",
    "-s",
    "vendor/security-core",
  ).split(/\s+/);
  assert.equal(modus, "160000");
  assert.equal(hash, PIN);
});

test("das ausgecheckte Submodul steht auf dem Pin", () => {
  assert.equal(git(SUBMODUL, "rev-parse", "HEAD"), PIN);
});

test("das Submodul ist unverändert (CC-4)", () => {
  assert.equal(git(SUBMODUL, "status", "--porcelain"), "");
});

test("die Naht start.ts exportiert startSecurityCore und ConfigError", async () => {
  const naht = await import(pathToFileURL(NAHT).href);
  assert.equal(typeof naht.startSecurityCore, "function");
  assert.equal(typeof naht.ConfigError, "function");
});
