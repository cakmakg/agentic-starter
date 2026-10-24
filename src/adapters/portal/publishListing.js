// ── adapters/portal/publishListing.js ────────────────────────────────────
// Der Tool Adapter `publish_listing` — VERTRAUENSSEITE (ADR-0031 Teil 3). Er läuft
// im Prozess des Security Core, neben dem Portalschlüssel, und ist nur über
// den Kern erreichbar. Vorbild: minimal-core/src/adapter/record-note.ts.
//
// Pflichten nach CC-6:
//   · die Argumente noch einmal prüfen, obwohl der Kern schon geprüft hat
//   · genau die eine Wirkung, die der Name sagt: ein POST /listings
//   · nur das versprochene Feld zurückgeben (`listingId`) — Portalantworten sind
//     fremde Daten
//   · den Schlüssel nie zurückgeben, nie loggen, nie in einen Fehlertext legen
//
// Der Schlüssel geht nur an einen Socket-Pfad, nie an eine Netzadresse: wer
// eine Adresse hält, bekommt, was an sie gesendet wird (Befund F2 im Kern).
//
// Importe: nur `node:*` und die Naht des Kerns (start.ts) — weder Kernel noch
// Domäne noch ein npm-Paket. Deshalb steht die Portalliste hier ein zweites
// Mal; ein Test hält sie gleich mit `TARGET_PORTALS` der Domäne.

import fs from "node:fs";
import http from "node:http";

import { ConfigError } from "../../../vendor/security-core/minimal-core/src/core/start.ts";

export const BEKANNTE_PORTALE = ["immoscout24", "immowelt", "kleinanzeigen"];

const MAX_TEXT_LENGTH = 5000;
const MAX_RESPONSE_BYTES = 4096;
const SCHLUESSEL_FORMAT = /^asp_[0-9a-f]{64}$/;

// Fail-closed und ohne Inhalt: eine kaputte Schlüsseldatei könnte den
// Schlüssel trotzdem enthalten. Kein trim() — eine Datei mit Zeilenende ist
// eine andere Datei, als der Operator meinte, und wird abgelehnt wie im Kern.
export function leseSchluesseldatei(pfad) {
  if (!pfad) throw new ConfigError("PORTAL_CREDENTIAL_FILE fehlt");
  let inhalt;
  try {
    inhalt = fs.readFileSync(pfad, "utf8");
  } catch {
    throw new ConfigError("PORTAL_CREDENTIAL_FILE ist nicht lesbar");
  }
  if (!SCHLUESSEL_FORMAT.test(inhalt)) {
    throw new ConfigError("PORTAL_CREDENTIAL_FILE hat das falsche Format");
  }
  return inhalt;
}

export function parseArguments(args) {
  if (typeof args !== "object" || args === null || Array.isArray(args))
    return undefined;
  if (Object.keys(args).sort().join(",") !== "portal,text") return undefined;
  const { portal, text } = args;
  if (typeof portal !== "string" || !BEKANNTE_PORTALE.includes(portal))
    return undefined;
  if (
    typeof text !== "string" ||
    text.length === 0 ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return undefined;
  }
  return { portal, text };
}

// Eine Anfrage über den Socket, begrenzt in Zeit und Antwortgröße. Jeder
// Fehler wird zu einem Fehler mit FESTEM Text — die Ursache bleibt zurück,
// weil sie Teile der Anfrage (und damit den Header) tragen könnte.
function postListing(socketPath, credential, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let zuGross = false;
    const req = http.request(
      {
        socketPath,
        method: "POST",
        path: "/listings",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const teile = [];
        let groesse = 0;
        res.on("data", (teil) => {
          groesse += teil.length;
          if (groesse > MAX_RESPONSE_BYTES) {
            // Ob danach noch "end" kommt, hängt vom Timing ab; die Markierung
            // macht das Ergebnis davon unabhängig.
            zuGross = true;
            req.destroy();
          } else teile.push(teil);
        });
        res.on("end", () => {
          clearTimeout(frist);
          if (zuGross) reject(new Error("unexpected portal response"));
          else resolve({ status: res.statusCode, body: Buffer.concat(teile) });
        });
        res.on("error", () => {});
      },
    );
    const frist = setTimeout(() => req.destroy(), timeoutMs);
    req.on("error", () => {
      clearTimeout(frist);
      reject(new Error("portal not reachable"));
    });
    req.on("close", () => {
      clearTimeout(frist);
      // nach resolve wirkungslos
      reject(new Error(zuGross ? "unexpected portal response" : "portal not reachable"));
    });
    req.end(body);
  });
}

export function createPublishListingAdapter({
  socketPath,
  credential,
  timeoutMs = 5000,
}) {
  return {
    action: "publish_listing",
    parseArguments,
    async execute(args) {
      const gueltig = parseArguments(args);
      if (gueltig === undefined)
        throw new Error("arguments failed re-validation");

      const antwort = await postListing(
        socketPath,
        credential,
        JSON.stringify({ portal: gueltig.portal, text: gueltig.text }),
        timeoutMs,
      );
      if (antwort.status !== 200)
        throw new Error("portal did not confirm the listing");

      let wert;
      try {
        wert = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(antwort.body),
        );
      } catch {
        throw new Error("unexpected portal response");
      }
      const listingId =
        typeof wert === "object" && wert !== null && !Array.isArray(wert)
          ? wert.listingId
          : undefined;
      if (!Number.isSafeInteger(listingId) || listingId <= 0) {
        throw new Error("unexpected portal response");
      }
      return { listingId };
    },
  };
}
