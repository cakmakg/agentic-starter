// ── evals/runners/quality.js ─────────────────────────────────────────────
// SCHICHT B — der AUSGABEVERTRAG gegen ein ECHTES Modell (T8, EVALS.md §3.8).
// Sie misst nicht Routing und nicht Richtlinien — das ist Schicht A und läuft
// im Mock. Sie misst die einzige Frage, die ein Mock per Konstruktion nicht
// beantworten kann: hält der Text, den ein echtes Modell schreibt, seinen
// Vertrag?
//
// KOSTET GELD und STREUT. Deshalb läuft sie NICHT in CI, nicht bei jedem Push
// und nicht ohne ausdrücklichen Aufruf (ADR-0019, ADR-0024).
//
// GEMESSEN WIRD DER ERSTE VERSUCH (ADR-0030). Der Graph darf nach einer
// Ablehnung erneut schreiben; zählte man erst das Ergebnis dieser Schleife,
// stünde am Ende fast zwangsläufig 100 % — gemessen wäre dann die Konvergenz
// der Schleife, nicht der Writer. Der Wert nach der Revision wird trotzdem
// berichtet: er sagt, was das Tor einbringt.
//
// Aufruf:
//   npm run evals:quality -- --dry-run          # zeigt den Plan, gibt NICHTS aus
//   npm run evals:quality -- --objekte 1        # Rauchprobe: 3 Aufrufe, wenige Cent
//   npm run evals:quality                       # voller Lauf
//   npm run evals:quality -- --max-usd 0.50     # härtere Ausgabengrenze

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(hier, "..");
const wurzel = path.resolve(evalsDir, "..");

// ── Argumente ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flagge = (name) => argv.includes(`--${name}`);
const wert = (name, standard) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? Number(argv[i + 1]) : standard;
};
// Nur diese drei Schalter verbrauchen das folgende Argument. Ohne diese Liste
// verschluckte `--dry-run immobilien` den Domänennamen und der Lauf fiele
// stillschweigend auf „alle Domänen" zurück.
const WERTSCHALTER = ["--max-usd", "--objekte", "--portale"];
const namen = argv.filter(
  (a, i) => !a.startsWith("--") && !WERTSCHALTER.includes(argv[i - 1]),
);

const TROCKEN = flagge("dry-run");
const MAX_USD = wert("max-usd", 1.0);
const MAX_OBJEKTE = wert("objekte", Infinity);
const MAX_VARIANTEN = wert("portale", Infinity);

// Auch dieser Lauf schreibt Zustand (Artefakte, Logs); er gehört nicht ins Repo.
process.env.STATE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "agentic-schichtb-zustand-"),
);

const { MOCK_LLM, env } = await import("../../src/kernel/config/env.js");

// Das Spiegelbild der Weigerung in policy.js. Dort: „kein echtes Modell".
// Hier: „kein Mock". Im Mock-Modus baut listingWriter seinen Text aus dem
// Datensatz — der Vertrag wäre per Konstruktion erfüllt und die 100 % wären
// eine Aussage über den eigenen Fixture-Generator, nicht über ein Modell.
if (MOCK_LLM && !TROCKEN) {
  console.error(
    "Schicht B braucht ein ECHTES Modell (ADR-0019). ANTHROPIC_API_KEY ist nicht gesetzt —\n" +
      "im Mock-Modus erfüllt der Writer seinen Vertrag per Konstruktion; die Zahl wäre keine Messung.\n" +
      "Den Plan ohne Schlüssel ansehen: npm run evals:quality -- --dry-run",
  );
  process.exit(1);
}

const { cost } = await import("../../src/kernel/observability/costTracker.js");
const { onLlmCall } = await import("../../src/kernel/llm/adapter.js");
const { vertragskonformitaet } = await import("../metrics/index.js");
const { DOMAENEN, ladeAdapter } = await import("../domains/index.js");

// ── Eine Domäne messen ───────────────────────────────────────────────────
async function fahreDomaene(adapter) {
  const b = adapter.schichtB;
  const faelle = b.faelle.slice(0, MAX_OBJEKTE);
  const varianten = b.varianten.slice(0, MAX_VARIANTEN);
  const geplant = faelle.length * varianten.length;

  console.log(
    `\nSchicht B · Domäne ${adapter.name} · Modell ${env.model} · ${faelle.length} Objekte × ${varianten.length} Portale\n`,
  );
  console.log(
    `  Geplant: ${geplant} Erstversuche, dazu bis zu ${b.maxVersuche - 1} Revisionen je Fall.`,
  );
  console.log(`  Ausgabengrenze: ${MAX_USD.toFixed(2)} USD (--max-usd)\n`);

  if (TROCKEN) {
    console.log(
      "  --dry-run: kein einziger Modellaufruf. Für die echte Messung den Schalter weglassen.\n",
    );
    return null;
  }

  cost.reset();
  let kostenUsd = 0;
  let aufrufe = 0;
  const abmelden = onLlmCall((c) => {
    kostenUsd += c.usd;
    aufrufe += 1;
  });

  const entwuerfe = [];
  let abgebrochen = null;

  try {
    for (const fall of faelle) {
      for (const variante of varianten) {
        if (kostenUsd >= MAX_USD) {
          abgebrochen = `Ausgabengrenze erreicht (${kostenUsd.toFixed(4)} USD ≥ ${MAX_USD.toFixed(2)})`;
          break;
        }

        const eintrag = {
          id: fall.id,
          variante,
          text: null,
          versuche: 0,
          konformImErstenVersuch: false,
          konformAmEnde: false,
          gruendeErsterVersuch: "",
          fehler: null,
        };

        try {
          // ── Versuch 1: das ist T8 ──────────────────────────────────────
          let text = await b.schreibe(fall.gegenstand, variante, "");
          eintrag.versuche = 1;
          eintrag.text = text;

          let urteil = b.pruefe(text, fall.gegenstand);
          eintrag.konformImErstenVersuch = urteil.konform;
          eintrag.gruendeErsterVersuch = urteil.gruende;
          eintrag.konformAmEnde = urteil.konform;

          // ── Die Revisionsschleife, wie BREMSE6b sie fährt ──────────────
          // Eigene Zahl, nicht T8: sie sagt, ob das Feedback des Tors den
          // Writer tatsächlich auf den Vertrag zieht.
          while (
            !urteil.konform &&
            eintrag.versuche < b.maxVersuche &&
            kostenUsd < MAX_USD
          ) {
            text = await b.schreibe(fall.gegenstand, variante, urteil.gruende);
            eintrag.versuche += 1;
            urteil = b.pruefe(text, fall.gegenstand);
            eintrag.konformAmEnde = urteil.konform;
          }
        } catch (e) {
          // Ein Netz- oder Modellfehler beendet nicht den ganzen Lauf: was
          // bereits gemessen wurde, ist bezahlt und gehört in den Bericht.
          eintrag.fehler = e.message;
        }

        entwuerfe.push(eintrag);
        const zeichen = eintrag.fehler
          ? "🔴"
          : eintrag.konformImErstenVersuch
            ? "🟢"
            : eintrag.konformAmEnde
              ? "🟡"
              : "🔴";
        console.log(
          `  ${zeichen} ${eintrag.id} · ${variante.padEnd(14)} ${eintrag.versuche} Versuch(e)` +
            (eintrag.fehler
              ? `  FEHLER: ${eintrag.fehler}`
              : eintrag.konformImErstenVersuch
                ? ""
                : `  → ${eintrag.gruendeErsterVersuch.slice(0, 90)}`),
        );
      }
      if (abgebrochen) break;
    }
  } finally {
    abmelden();
  }

  const metriken = vertragskonformitaet(entwuerfe);

  const bericht = {
    erzeugt: new Date().toISOString(),
    schicht: "B",
    modus: "echtes Modell",
    modell: env.model,
    domaene: adapter.name,
    // Schicht B ist NICHT deterministisch. Statt eines Determinismus-Nachweises
    // steht hier, was den Lauf bestimmt hat — sonst wäre die Zahl später nicht
    // einzuordnen.
    deterministisch: false,
    stichprobe: {
      objekte: faelle.length,
      varianten: varianten.length,
      entwuerfe: entwuerfe.length,
      modellaufrufe: aufrufe,
    },
    kostenUsd: Number(kostenUsd.toFixed(6)),
    abgebrochen,
    metriken,
    entwuerfe,
  };

  const berichtDir = path.join(evalsDir, "reports");
  fs.mkdirSync(berichtDir, { recursive: true });
  const datei = path.join(
    berichtDir,
    `${bericht.erzeugt.slice(0, 10)}-schicht-b-${adapter.name}.json`,
  );
  fs.writeFileSync(datei, JSON.stringify(bericht, null, 2) + "\n");

  // ── Konsolenausgabe ────────────────────────────────────────────────────
  const proz = (w) =>
    w === null ? "nicht messbar" : `${(w * 100).toFixed(1)} %`;
  const m38 = metriken["3.8"];
  const mrev = metriken.nachRevision;

  console.log(
    `\n  ${m38.name.padEnd(38)} ${proz(m38.wert).padStart(13)}   (${m38.zaehler}/${m38.nenner})   ← T8`,
  );
  console.log(
    `  ${mrev.name.padEnd(38)} ${proz(mrev.wert).padStart(13)}   (${mrev.zaehler}/${mrev.nenner})`,
  );
  console.log(
    `  ${"Schreibversuche je Inserat".padEnd(38)} ${`Median ${metriken.versucheMedian}`.padStart(13)}`,
  );
  console.log(
    `  ${"Kosten dieses Laufs".padEnd(38)} ${`${kostenUsd.toFixed(4)} USD`.padStart(13)}   (${aufrufe} Aufrufe)`,
  );

  if (metriken.verletzungen.length) {
    console.log(`\n  Im ersten Versuch beanstandet:`);
    for (const v of metriken.verletzungen) {
      console.log(`   🔴 ${v.id} · ${v.variante}`);
      console.log(`      ${v.gruende}`);
    }
  }
  if (abgebrochen) console.log(`\n  ⚠️  ${abgebrochen}`);
  console.log(`\n  Bericht: ${path.relative(wurzel, datei)}\n`);

  // T8 verlangt 100 %. Ein abgebrochener Lauf ist kein bestandener Lauf.
  return m38.erfuellt === true && !abgebrochen;
}

// ── Ausführen ────────────────────────────────────────────────────────────
const kandidaten = namen.length ? namen : DOMAENEN;
const ergebnisse = [];

for (const name of kandidaten) {
  const adapter = await ladeAdapter(name);
  if (!adapter.schichtB) {
    // Kein Fehler: `report` schuldet seinen Vertrag erst mit der Judge-Maschine
    // in Phase 4 (ADR-0024). Still übergehen wäre allerdings genau die Sorte
    // Lücke, die dieser Harness sichtbar machen soll.
    console.log(
      `\n  Domäne ${name}: kein Schicht-B-Abschnitt im Adapter — übersprungen.`,
    );
    continue;
  }
  ergebnisse.push([name, await fahreDomaene(adapter)]);
}

// Beenden, ohne den Exit-Code zu verlieren. `process.exit()` reißt hier offene
// HTTPS-Verbindungen des Modell-Clients mitten im Abbau ab; auf Windows stirbt
// der Prozess dann an einer libuv-Assertion und meldet 127 statt 0 oder 1 —
// ein Harness, dessen Exit-Code nicht trägt, ist genau der Defekt, den dieses
// Repo misst. Also: Code setzen, den Sockets Zeit zum Schließen lassen und nur
// erzwingen, wenn doch etwas hängen bleibt (der Timer hält den Prozess dank
// unref selbst nicht am Leben).
function beende(code) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 3000).unref();
}

if (ergebnisse.length === 0) {
  console.error("Keine Domäne mit Schicht-B-Abschnitt gefunden.");
  beende(1);
} else if (TROCKEN) {
  beende(0);
} else {
  beende(ergebnisse.every(([, ok]) => ok) ? 0 : 1);
}
