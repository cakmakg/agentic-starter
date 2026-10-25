// ── adapters/security-core/client.js ─────────────────────────────────────
// Der TB-1-Client der AGENTENSEITE (ADR-0031 Teil 7): die einzige Art, wie
// agentic-starter eine Wirkung anfragt. Er kennt keinen Schlüssel, keine Domäne
// und keinen Aktionsnamen — er trägt eine Anfrage zum Security Core und liest
// dessen Antwort.
//
// Strenge Deutung wie `interpretOutcome` im Kern (minimal-core/src/agent/client.ts):
// nur ein wohlgeformtes `rejected` heißt „keine Wirkung". Alles andere — auch
// eine Zeitüberschreitung, eine abgebrochene Verbindung, eine unlesbare
// Antwort — ist `failed`: die Wirkung ist unbekannt.
//
// Importiert nur `node:*`. Den Code des Kerns importiert er nicht; er spricht
// nur dessen Protokoll (docs/09 §3.2 im Kern).

import http from "node:http";

// Länger als die Zeitgrenze des Adapters zum Portal (5 s): der Kern selbst
// begrenzt die Ausführung nicht, eine normale Antwort muss vorher ankommen.
const TIMEOUT_MS = 10_000;

const FAILED = Object.freeze({ outcome: "failed" });

function istObjekt(wert) {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function deuteAntwort(text) {
  let wert;
  try {
    wert = JSON.parse(text);
  } catch {
    return FAILED;
  }
  if (!istObjekt(wert)) return FAILED;
  const felder = Object.keys(wert).sort().join(",");
  if (
    wert.outcome === "executed" &&
    felder === "outcome,result" &&
    istObjekt(wert.result)
  ) {
    return { outcome: "executed", result: wert.result };
  }
  if (
    wert.outcome === "rejected" &&
    felder === "outcome,reason" &&
    typeof wert.reason === "string"
  ) {
    return { outcome: "rejected", reason: wert.reason };
  }
  return FAILED;
}

// Eine Anfrage, eine Verbindung (`agent: false`): der Kern liest je Verbindung
// genau eine Anfrage (docs/09 §3.2, Klarstellung 5). Wirft nie.
export function frageKern(
  socketPath,
  action,
  args,
  { timeoutMs = TIMEOUT_MS } = {},
) {
  return new Promise((resolve) => {
    let frist;
    let fertig = false;
    const ende = (ergebnis) => {
      if (fertig) return;
      fertig = true;
      clearTimeout(frist);
      resolve(ergebnis);
    };

    let body;
    try {
      body = JSON.stringify({ action, arguments: args });
    } catch {
      return ende(FAILED);
    }

    const req = http.request(
      {
        socketPath,
        method: "POST",
        path: "/actions",
        agent: false,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const teile = [];
        res.on("data", (teil) => teile.push(teil));
        res.on("end", () =>
          ende(deuteAntwort(Buffer.concat(teile).toString("utf8"))),
        );
        // Nach "end" wirkungslos; ohne "end" ist die Antwort abgebrochen.
        res.on("close", () => ende(FAILED));
      },
    );
    req.on("error", () => ende(FAILED));
    frist = setTimeout(() => {
      req.destroy();
      ende(FAILED);
    }, timeoutMs);
    req.end(body);
  });
}

// Ein Executor für den Action-Worker (ADR-0031 Teil 7): übersetzt den Queue-Typ
// in den Namen, unter dem der Kern die Aktion kennt, und gibt das Payload
// unverändert als `arguments` weiter. Die Zuordnung bringt der Aufrufer mit —
// der Client kennt keine Domäne. Ein Typ ohne Kernnamen wird nicht gesendet und
// ergibt `failed`: `rejected` sagt nur der Kern.
export function kernExecutor({ socketPath, kernNamen }) {
  return async ({ actionType, payload }) => {
    const name = Object.hasOwn(kernNamen, actionType)
      ? kernNamen[actionType]
      : undefined;
    if (typeof name !== "string") return FAILED;
    return frageKern(socketPath, name, payload);
  };
}
