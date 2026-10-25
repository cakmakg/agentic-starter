// ── tests/helpers/prozesse.js ────────────────────────────────────────────
// Die bin-Skripte als echte Kindprozesse: Scheinportal und Kern laufen bis
// "ready", die Demo läuft bis zu ihrem Ende. Die Umgebung ist leer bis auf PATH
// und das Übergebene — so sieht ein Test, welche Variablen ein Prozess braucht.

import { spawn } from "node:child_process";
import path from "node:path";

const BIN = path.resolve(import.meta.dirname, "..", "..", "src", "bin");

function kindprozess(skript, env) {
  return spawn(process.execPath, [path.join(BIN, skript)], {
    env: { PATH: process.env.PATH ?? "", ...env },
  });
}

// Wartet auf "ready" oder auf das Ende des Prozesses.
export function starte(skript, env) {
  return new Promise((resolve, reject) => {
    const kind = kindprozess(skript, env);
    let stdout = "";
    let stderr = "";
    kind.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.includes("ready "))
        resolve({ kind, bereit: true, stdout, stderr });
    });
    kind.stderr.on("data", (d) => (stderr += d));
    kind.on("error", reject);
    kind.on("exit", (code) =>
      resolve({ kind, bereit: false, code, stdout, stderr }),
    );
  });
}

// Wartet auf das Ende des Prozesses.
export function laufe(skript, env) {
  return new Promise((resolve, reject) => {
    const kind = kindprozess(skript, env);
    let stdout = "";
    let stderr = "";
    kind.stdout.on("data", (d) => (stdout += d));
    kind.stderr.on("data", (d) => (stderr += d));
    kind.on("error", reject);
    kind.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export function stoppe(kind) {
  return new Promise((r) => {
    // Durch ein Signal beendet, bleibt exitCode null — dann steht signalCode.
    if (kind.exitCode !== null || kind.signalCode !== null) return r();
    kind.once("exit", () => r());
    kind.kill();
  });
}
