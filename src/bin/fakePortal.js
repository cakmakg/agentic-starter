// ── bin/fakePortal.js ────────────────────────────────────────────────────
// Prozess des Scheinportals (ADR-0031 Teil 3). Liest nur:
//   PORTAL_SOCKET               wo es lauscht (Unix-Socket, unter Windows Named Pipe)
//   PORTAL_CREDENTIAL_HASH_FILE SHA-256 des Schlüssels, genau 64 Hex-Zeichen
//
// Fail-closed: jeder Fehler beim Start beendet den Prozess mit einem FESTEN
// Text, bevor er lauscht — nie mit dem Inhalt einer Datei.

import fs from "node:fs";

import { startFakePortal } from "../adapters/portal/fakePortal.js";

class StartFehler extends Error {}

function leseSocketPfad(wert) {
  const gueltig =
    process.platform === "win32" ? /^\\\\[.?]\\pipe\\[^\\]+$/ : /^\/[^\0]+$/;
  if (!wert || !gueltig.test(wert)) {
    throw new StartFehler("PORTAL_SOCKET muss ein absoluter Socket-Pfad sein");
  }
  return wert;
}

function leseHashDatei(pfad) {
  if (!pfad) throw new StartFehler("PORTAL_CREDENTIAL_HASH_FILE fehlt");
  let inhalt;
  try {
    inhalt = fs.readFileSync(pfad, "utf8");
  } catch {
    throw new StartFehler("PORTAL_CREDENTIAL_HASH_FILE ist nicht lesbar");
  }
  if (!/^[0-9a-f]{64}$/.test(inhalt)) {
    throw new StartFehler("PORTAL_CREDENTIAL_HASH_FILE hat das falsche Format");
  }
  return inhalt;
}

try {
  const portal = await startFakePortal({
    socketPath: leseSocketPfad(process.env.PORTAL_SOCKET),
    credentialHash: leseHashDatei(process.env.PORTAL_CREDENTIAL_HASH_FILE),
  });
  process.stdout.write(`ready ${portal.socketPath}\n`);
} catch (fehler) {
  const text =
    fehler instanceof StartFehler ? fehler.message : "Start fehlgeschlagen";
  process.stderr.write(`scheinportal: ${text}\n`);
  process.exit(1);
}
