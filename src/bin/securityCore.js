// ── bin/securityCore.js ──────────────────────────────────────────────────
// Einstieg der VERTRAUENSSEITE (ADR-0031 Teil 3): startet den Security Core mit
// dem einen Tool Adapter dieses Produkts. Läuft unter dem Benutzer des Kerns.
//   CORE_SOCKET             TB-1 — liest der Kern selbst (start.ts)
//   PORTAL_SOCKET           wohin der Adapter den Schlüssel schickt
//   PORTAL_CREDENTIAL_FILE  der Portalschlüssel, asp_ + 64 Hex
//
// Fail-closed: startSecurityCore ruft composeAdapters innerhalb seines Starts
// auf. Jeder Fehler beendet den Prozess, bevor TB-1 lauscht; ausgegeben wird
// nur der Text eines ConfigError, nie ein Inhalt (INV-8).
// Importiert nur die Naht start.ts und Dateien der Vertrauensseite.

import {
  ConfigError,
  startSecurityCore,
} from "../../vendor/security-core/minimal-core/src/core/start.ts";
import {
  createPublishListingAdapter,
  leseSchluesseldatei,
} from "../adapters/portal/publishListing.js";

function leseSocketPfad(wert) {
  const gueltig =
    process.platform === "win32" ? /^\\\\[.?]\\pipe\\[^\\]+$/ : /^\/[^\0]+$/;
  if (!wert || !gueltig.test(wert)) {
    throw new ConfigError("PORTAL_SOCKET muss ein absoluter Socket-Pfad sein");
  }
  return wert;
}

await startSecurityCore(() => [
  createPublishListingAdapter({
    socketPath: leseSocketPfad(process.env.PORTAL_SOCKET),
    credential: leseSchluesseldatei(process.env.PORTAL_CREDENTIAL_FILE),
  }),
]);
