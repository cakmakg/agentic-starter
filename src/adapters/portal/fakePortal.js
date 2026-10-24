// ── adapters/portal/fakePortal.js ────────────────────────────────────────
// Das Scheinportal — AUSSENWELT, nicht Vertrauensseite (ADR-0031 Teil 3). Es
// steht für ein echtes Portal, damit Stufe 1 eine echte Wirkung hat, ohne dass
// etwas die Maschine verlässt.
//
// Vorbild ist das Scheinsystem des Security Core (minimal-core/src/mock/mock.ts):
// JEDER Endpunkt verlangt den Schlüssel — die Wirkung ebenso wie ihre
// Beobachtung. Es gibt also keinen Weg hinein ohne ihn.
//
//   POST /listings  {portal, text} → 200 {listingId}   die einzige Wirkung
//   GET  /listings                 → 200 {listings}    nur für den Operator
//
// Das Portal hält nur den SHA-256-Hash des Schlüssels (ADR-0031, Nachtrag):
// so liegt der Schlüssel selbst an genau einer Stelle, beim Kern.
//
// Eine `listingId` ist eine Nummer, keine Berechtigung (CC-6, Q-25): kein
// Endpunkt nimmt sie an. Importiert nur `node:*`.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

const MAX_BODY_BYTES = 32 * 1024;

export function hashVon(schluessel) {
  return crypto.createHash("sha256").update(schluessel, "utf8").digest();
}

// Verglichen werden Hashes gleicher Länge, laufzeitkonstant — so verrät weder
// die Dauer noch die Länge des gesendeten Werts etwas über den erwarteten.
function berechtigt(req, erwarteterHash) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return crypto.timingSafeEqual(hashVon(header.slice(7)), erwarteterHash);
}

function sendeJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

// undefined, wenn der Körper die Grenze überschreitet. Der Rest wird gelesen
// statt die Verbindung zu kappen, damit die Antwort noch ankommt.
function leseKoerper(req) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let groesse = 0;
    req.on("data", (teil) => {
      groesse += teil.length;
      if (groesse <= MAX_BODY_BYTES) teile.push(teil);
    });
    req.on("end", () =>
      resolve(groesse > MAX_BODY_BYTES ? undefined : Buffer.concat(teile)),
    );
    req.on("error", reject);
  });
}

function leseInserat(koerper) {
  let wert;
  try {
    wert = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(koerper),
    );
  } catch {
    return undefined;
  }
  if (typeof wert !== "object" || wert === null || Array.isArray(wert))
    return undefined;
  const schluessel = Object.keys(wert).sort().join(",");
  if (schluessel !== "portal,text") return undefined;
  if (typeof wert.portal !== "string" || typeof wert.text !== "string")
    return undefined;
  return { portal: wert.portal, text: wert.text };
}

export async function startFakePortal({ socketPath, credentialHash }) {
  const erwarteterHash = Buffer.from(credentialHash, "hex");
  if (erwarteterHash.length !== 32)
    throw new Error("credentialHash muss SHA-256 sein");
  const inserate = [];

  const server = http.createServer((req, res) => {
    (async () => {
      if (!berechtigt(req, erwarteterHash)) {
        req.resume();
        return sendeJson(res, 401, { error: "unauthorized" });
      }
      if (req.method === "GET" && req.url === "/listings") {
        return sendeJson(res, 200, { listings: inserate });
      }
      if (req.method !== "POST" || req.url !== "/listings") {
        req.resume();
        return sendeJson(res, 404, { error: "not_found" });
      }
      const koerper = await leseKoerper(req);
      const inserat = koerper === undefined ? undefined : leseInserat(koerper);
      if (inserat === undefined)
        return sendeJson(res, 400, { error: "invalid_request" });

      const listingId = inserate.length + 1;
      inserate.push({ listingId, ...inserat });
      sendeJson(res, 200, { listingId });
    })().catch(() => sendeJson(res, 500, { error: "internal_error" }));
  });

  // Ein Socket aus einem früheren Lauf wird ersetzt. Unter Windows ist der Pfad
  // eine Named Pipe und verschwindet mit dem Prozess.
  const unix = process.platform !== "win32";
  if (unix) {
    try {
      if (fs.lstatSync(socketPath).isSocket()) fs.unlinkSync(socketPath);
    } catch {
      // nichts da
    }
  }
  const offen = new Set();
  server.on("connection", (s) => {
    offen.add(s);
    s.on("close", () => offen.delete(s));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      // Eigentümer und Gruppe dürfen verbinden, sonst niemand. Wer überhaupt
      // hineinkommt, entscheidet das Verzeichnis (WSL2-Lauf, Teil 5).
      if (unix) fs.chmodSync(socketPath, 0o660);
      resolve();
    });
  });

  return {
    socketPath,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        for (const s of offen) s.destroy();
      }),
  };
}
