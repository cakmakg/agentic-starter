// ── kernel/security/actionQueue.js ───────────────────────────────────────
// MOAT Layer 4 — AKTIONS-ISOLATION. Die QUEUE-MECHANIK; die WHITELIST bringt
// die Domäne mit. Das ist die dritte feine Stelle der Naht aus ADR-0018.
//
//   Agent → ActionQueue (SCHREIBT nur) → Worker (liest + VALIDIERT + führt aus)
//
// Zwei Tore:
//   1) enqueueAction: steht der actionType nicht auf der Whitelist, wird schon
//      VOR dem Schreiben abgelehnt.
//   2) Worker: prüft das Payload gegen Schema und Länge. Ist die Wirkung
//      unbekannt, FAILED — ohne Wiederholung (ADR-0031 Teil 5).
//
// So kann selbst ein gekaperter Agent nur Aktionen in die Queue legen, die auf
// der Whitelist stehen und begrenzt sind — an die Außenwelt kommt er nicht direkt.
//
// IDEMPOTENZ (ADR-0026). Solange der Worker nur simuliert, ist eine doppelt
// eingereihte Aktion harmlos. Sobald dort ein echter Portal-Aufruf steht, ist sie
// ein zweites Inserat. Deshalb steht die Regel HIER und nicht später:
//   · Jede Aktion trägt einen Schlüssel — mitgegeben oder aus (threadId,
//     actionType, payload) deterministisch abgeleitet.
//   · Ein bekannter Schlüssel wird nicht erneut geschrieben; enqueueAction gibt
//     die id der bereits vorhandenen Aktion zurück.
//   · Der Worker verarbeitet höchstens einen Durchgang gleichzeitig, damit ein
//     langsamer Aufruf nicht in zwei Takten zugleich läuft.
// Seit T11 überlebt beides einen Neustart: die Queue und der Dedup-Index liegen
// hinter derselben Dauerhaftigkeits-Schicht wie Checkpoints und Artefakte
// (ADR-0027). Die Zusage aus ADR-0026 gilt damit nicht mehr nur innerhalb eines
// Prozesslebens — ein Neustart reiht dieselbe Aktion nicht erneut ein.

import crypto from "node:crypto";

import { appendLog, readLog } from "../persistence/store.js";

// Stabile Serialisierung: dasselbe Payload muss denselben Schlüssel ergeben,
// auch wenn seine Felder in anderer Reihenfolge entstanden sind. JSON.stringify
// allein leistet das nicht — es schreibt in Einfügereihenfolge.
function stabil(wert) {
  if (wert === null || typeof wert !== "object") return JSON.stringify(wert) ?? "null";
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(",")}]`;
  return `{${Object.keys(wert)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stabil(wert[k])}`)
    .join(",")}}`;
}

function schluesselAus({ threadId, actionType, payload }) {
  // Längenpräfixe statt eines Trennzeichens: so kann kein Feldinhalt die Grenze
  // zwischen zwei Feldern nachbilden. String() davor, weil eine fehlende
  // threadId hier keinen Absturz wert ist — sie ergibt einen eigenen Schlüssel.
  const felder = [String(threadId), String(actionType), stabil(payload)];
  return crypto
    .createHash("sha256")
    .update(felder.map((f) => `${f.length}:${f}`).join(""))
    .digest("hex")
    .slice(0, 32);
}

export function createActionQueue({ whitelist, validators, logName }) {
  const erlaubt = new Set(whitelist);
  const queue = []; // { id, threadId, actionType, payload, status, attempts, idempotencyKey }
  const nachSchluessel = new Map(); // idempotencyKey -> id
  let _id = 0;
  let timer = null;
  let laeuft = false; // ein Worker-Durchgang zur Zeit
  let geladen = false;
  let executor = null; // kommt mit startActionWorker, nicht mit der Queue

  // Erst beim ersten Zugriff, nicht beim Import: das Laden eines Moduls soll
  // keine Dateien anfassen. Ohne logName bleibt die Queue flüchtig — so kann
  // ein Aufrufer, der bewusst keinen dauerhaften Zustand will, ihn auch nicht
  // versehentlich bekommen.
  function laden() {
    if (geladen || !logName) return;
    geladen = true;
    for (const e of readLog(logName)) {
      if (e.art === "enqueue") {
        queue.push({ ...e.action });
        nachSchluessel.set(e.action.idempotencyKey, e.action.id);
      } else if (e.art === "status") {
        const a = queue.find((x) => x.id === e.id);
        if (a) {
          a.status = e.status;
          a.attempts = e.attempts;
          if ("result" in e) a.result = e.result;
          if ("reason" in e) a.reason = e.reason;
        }
      }
    }
    // Endet eine Aktion im Log auf PROCESSING, wurde ihr Aufruf unterbrochen:
    // Wirkung unbekannt → FAILED. Nur im Speicher, nicht ins Log: Lesen soll
    // nichts schreiben, und ohne Sperre zwischen Prozessen (ARCHITECTURE.md §4)
    // könnte ein so geschriebenes FAILED hinter dem DONE eines noch laufenden
    // Aufrufs landen. Die letzte Zeile bleibt PROCESSING; jedes Abspielen kommt
    // zum selben Ergebnis.
    for (const a of queue) if (a.status === "PROCESSING") a.status = "FAILED";
    // Der Zähler setzt ÜBER der höchsten bekannten id auf. Bei 0 zu beginnen
    // vergäbe eine id zweimal, und `finde(id)` träfe dann die falsche Aktion.
    _id = queue.reduce((max, a) => Math.max(max, a.id), 0);
  }

  // Statuswechsel gehören ins Log, sonst führte ein Neustart eine bereits
  // erledigte Aktion erneut aus — genau das, was ADR-0026 verhindern soll.
  // `zusatz` trägt, was der Executor zurückgab (`result` oder `reason`). Der
  // Kernel deutet es nicht — er kennt keine listingId, nur das Ergebnis.
  function statusSetzen(action, status, zusatz = {}) {
    action.status = status;
    Object.assign(action, zusatz);
    if (logName) {
      appendLog(logName, {
        art: "status",
        id: action.id,
        status,
        attempts: action.attempts,
        ...zusatz,
      });
    }
  }

  function enqueueAction({ threadId, actionType, payload, idempotencyKey }) {
    // TOR 1 bleibt das erste Tor: nicht auf der Whitelist → nicht einmal
    // schreiben. Die Dedup-Prüfung kommt DANACH, damit ein nicht erlaubter Typ
    // auch dann auffliegt, wenn er einen bekannten Schlüssel mitbringt.
    if (!erlaubt.has(actionType)) {
      throw new Error(
        `actionType steht nicht auf der Whitelist: ${actionType}`,
      );
    }
    laden();

    const schluessel =
      idempotencyKey ?? schluesselAus({ threadId, actionType, payload });

    // Schon bekannt → keine zweite Zeile, sondern dieselbe id. Auch dann, wenn
    // die erste REJECTED oder FAILED endete: gleiche Eingabe, gleiches Ergebnis.
    // Ein neuer Versuch ist ein neuer Schlüssel, keine stille Wiederholung.
    const vorhanden = nachSchluessel.get(schluessel);
    if (vorhanden !== undefined) return vorhanden;

    const action = {
      id: ++_id,
      threadId,
      actionType,
      payload,
      idempotencyKey: schluessel,
      status: "PENDING",
      attempts: 0,
    };
    queue.push(action);
    nachSchluessel.set(schluessel, action.id);
    if (logName) appendLog(logName, { art: "enqueue", action });
    return action.id;
  }

  // Worker: läuft periodisch. Atomar übernehmen → validieren → ausführen → abbilden.
  async function processOne(action) {
    action.attempts++;

    // TOR 2: Payload-Validierung.
    const ok = validators[action.actionType]?.(action.payload);
    if (!ok) {
      statusSetzen(action, "REJECTED");
      return;
    }

    // PROCESSING steht VOR dem Aufruf im Log (ADR-0031 Teil 5). Stirbt der
    // Prozess mitten im Aufruf, ist die Wirkung unbekannt; beim Abspielen wird
    // die Aktion deshalb FAILED und nicht wieder PENDING — ein zweiter Lauf
    // könnte ein zweites Inserat sein. Ein Absturz zwischen Logzeile und Versand
    // ergibt FAILED, obwohl nichts gesendet wurde: die sichere Richtung.
    statusSetzen(action, "PROCESSING");

    let antwort;
    try {
      // Der Executor bekommt nur, was die Wirkung braucht: threadId und
      // idempotencyKey verlassen die Queue nicht (ADR-0031 Teil 7). Eine Kopie,
      // damit er das eingereihte Payload nicht verändern kann.
      antwort = await executor({
        actionType: action.actionType,
        payload: structuredClone(action.payload),
      });
    } catch {
      antwort = null; // eine Ausnahme ist kein Ergebnis: Wirkung unbekannt
    }

    // Abbildung nach ADR-0031 Teil 5, so streng wie der TB-1-Client: nur ein
    // wohlgeformtes `rejected` heißt „keine Wirkung". Alles andere — `failed`,
    // ein `rejected` ohne Grund, eine Ausnahme — ist eine unbekannte Wirkung.
    if (antwort?.outcome === "executed") {
      statusSetzen(action, "DONE", { result: antwort.result });
    } else if (
      antwort?.outcome === "rejected" &&
      typeof antwort.reason === "string"
    ) {
      statusSetzen(action, "REJECTED", { reason: antwort.reason });
    } else {
      // Keine Wiederholung (ADR-0031 Teil 5): nach einer unbekannten Wirkung
      // könnte ein zweiter Versuch ein zweites Inserat sein. Ein neuer Versuch
      // ist die Entscheidung eines Menschen — und damit ein neuer Schlüssel.
      statusSetzen(action, "FAILED");
    }
  }

  // Der Executor ist Pflicht und kommt mit dem Start, nicht mit der Queue
  // (ADR-0031 Teil 6): die Queue ist ein Singleton der Domäne, und eine Domäne
  // importiert keinen Adapter. Ohne Executor kein Worker — kein versteckter
  // Standard, kein Zweig „Mock oder echt".
  function startActionWorker({ executor: ausfuehren, intervalMs = 5000 } = {}) {
    if (typeof ausfuehren !== "function") {
      throw new Error("startActionWorker braucht einen Executor");
    }
    if (timer) return;
    executor = ausfuehren;
    timer = setInterval(async () => {
      // Ohne diese Sperre kann der nächste Takt starten, während der vorige noch
      // auf einen Aufruf wartet — und dieselbe PENDING-Aktion ein zweites Mal
      // aufnehmen. Heute simuliert der Aufruf nur; morgen dauert er.
      if (laeuft) return;
      laeuft = true;
      try {
        laden();
        const pending = queue.filter((a) => a.status === "PENDING");
        for (const a of pending) await processOne(a);
      } finally {
        laeuft = false;
      }
    }, intervalMs);
    timer.unref?.();
  }

  function stopActionWorker() {
    clearInterval(timer);
    timer = null;
  }

  // Eine Kopie: von außen ist die Queue nicht manipulierbar.
  function getQueue() {
    laden();
    return queue.slice();
  }

  return { enqueueAction, getQueue, startActionWorker, stopActionWorker };
}
