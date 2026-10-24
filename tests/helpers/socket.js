// ── tests/helpers/socket.js ──────────────────────────────────────────────
// Ein frischer Socket-Pfad je Aufruf: unter Windows eine Named Pipe, sonst
// ein Unix-Socket im Temp-Verzeichnis (wie minimal-core/test/helpers.ts).

import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export function neuerSocketPfad() {
  const name = `as-${crypto.randomBytes(8).toString("hex")}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : path.join(os.tmpdir(), `${name}.sock`);
}

export function neuerSchluessel() {
  return `asp_${crypto.randomBytes(32).toString("hex")}`;
}

// Eine rohe HTTP-Anfrage über den Socket — so, wie ein beliebiger lokaler
// Aufrufer sie schicken könnte.
export function anfrage(
  socketPath,
  { method = "GET", pfad = "/", headers = {}, body } = {},
) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath, method, path: pfad, headers },
      (res) => {
        const teile = [];
        res.on("data", (t) => teile.push(t));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            text: Buffer.concat(teile).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
