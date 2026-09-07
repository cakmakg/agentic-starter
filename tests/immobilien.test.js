// ── tests/immobilien.test.js ─────────────────────────────────────────────
// Die deterministischen Teile der Domäne `immobilien`. Bis hierher hatte die
// Domäne NULL Tests: sie lief (Demo grün, T10 und T11 grün), aber gemessen hat
// sie niemand. Die Zeile „Vertrag erfüllt (T8)" im Demo-Log war eine Ausgabe,
// kein Messwert.
//
// WAS HIER NICHT GEMESSEN WIRD, und warum das wichtig ist: nicht der Writer.
// Im Mock-Modus ersetzt `listingWriter.js` die Modellantwort durch einen aus
// `state.property` gebauten Text — der Vertrag ist dann per Konstruktion
// erfüllt. T8 im Mock zu „messen" hieße, den eigenen Fixture-Generator zu
// messen. Der echte T8-Wert braucht ein echtes Modell (Schicht B, ADR-0019).
//
// Gemessen wird stattdessen DAS TOR: fängt `contractChecker` die Verletzung?
// Das ist die Frage, die den Kunden schützt, und sie ist deterministisch —
// also kostenlos und in CI. Ein Prüfer, der nie etwas findet, meldet dieselben
// 100 % wie einer, der alles findet; der Datensatz unter
// `evals/domains/immobilien/golden/` ist genau dieser Unterschied.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();

// Traces dürfen nicht ins Repo laufen: eigenes Verzeichnis, VOR dem Import.
process.env.TRACE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "trace-immobilien-"),
);

const { contractCheckerNode } =
  await import("../src/domains/immobilien/agents/contractChecker.js");
const { portfolioLoaderNode } =
  await import("../src/domains/immobilien/agents/portfolioLoader.js");
const { listingStoreNode, getListingArtifact, markDelivered } =
  await import("../src/domains/immobilien/agents/listingStore.js");
const { deliveryNode } =
  await import("../src/domains/immobilien/agents/delivery.js");
const { getQueue } = await import("../src/domains/immobilien/actions.js");

const hier = path.dirname(fileURLToPath(import.meta.url));
const golden = path.resolve(
  hier,
  "..",
  "evals",
  "domains",
  "immobilien",
  "golden",
);
const lies = (datei) =>
  JSON.parse(fs.readFileSync(path.join(golden, datei), "utf8"));

const portfolio = lies("portfolio.json");
const negativ = lies("negative-listings.json");

const objekt = (id) => {
  const o = portfolio.objekte.find((x) => x.id === id);
  if (!o) throw new Error(`Datensatz ${id} fehlt im Portfolio`);
  return o;
};

// Ein einzelnes Inserat durch das Tor schicken. contractCheckerNode arbeitet
// über alle Portale; für die Prüfung genügt eines.
function pruefe(text, property) {
  const r = contractCheckerNode({ listings: { pruef: text }, property });
  return { gueltig: r.isContractValid === true, gruende: r.contractFeedback };
}

// ── Der Datensatz gegen das Tor ──────────────────────────────────────────
// Datengetrieben: jeder Fall aus der Kundenerkundung §2 wird zu einem Test.
// Geprüft werden GRÜNDE, nicht „verletzt ja/nein" — fast jeder dieser kurzen
// Texte verletzt nebenbei auch Pflichtfelder, weil er kein volles Inserat ist.
// Wer nur auf „es gab eine Verletzung" prüft, bekäme selbst dann grün, wenn
// der Prüfer die eigentliche Sache übersieht.

for (const fall of negativ.faelle) {
  const name = `${fall.id} (${fall.datensatz}): ${fall.was.split(".")[0]}`;
  const optionen = fall.status === "luecke" ? { todo: fall.was } : {};

  test(name, optionen, () => {
    const { gruende } = pruefe(fall.text, objekt(fall.datensatz));

    for (const erwartet of fall.erwartet.gruende) {
      assert.ok(
        gruende.includes(erwartet),
        `erwarteter Grund fehlt: ${erwartet}\nGemeldet: ${gruende || "(nichts)"}`,
      );
    }
    for (const verboten of fall.erwartet.ohne) {
      assert.ok(
        !gruende.includes(verboten),
        `Falschvorwurf: "${verboten}" wurde gemeldet\nGemeldet: ${gruende}`,
      );
    }
  });
}

// ── Der Gegenbeweis: ein korrektes Inserat kommt durch ───────────────────

test("Ein vertragskonformes Inserat wird nicht beanstandet", () => {
  const p = objekt("P04");
  const text =
    `${p.objektart} in ${p.adresse}. ` +
    `${p.wohnflaeche_m2} m², ${p.zimmer} Zimmer. Preis: ${p.preis} €. ` +
    `Baujahr ${p.baujahr}. Energieklasse ${p.energieausweis}. ${p.fotos} Fotos.`;

  const { gueltig, gruende } = pruefe(text, p);
  assert.equal(gueltig, true, `unerwartet beanstandet: ${gruende}`);
});

test("Dezimale Wohnfläche ist kein Falschvorwurf", () => {
  // War ein Defekt, gefunden über den Randfall „Dezimalfläche mit Komma"
  // (Kundenerkundung §1.1): normalizeNumber entfernte ALLE Punkte, auch den
  // Dezimalpunkt des FELDWERTS. 82.5 wurde zu "825" und passte nie zum korrekt
  // geschriebenen "82,5" im Text — das Objekt klagte sich selbst an. Behoben
  // mit ADR-0028: ein Zahlenwert wird nicht mehr wie Text behandelt.
  const p = objekt("P01");
  const text =
    `${p.objektart} in ${p.adresse}. 82,5 m², ${p.zimmer} Zimmer. ` +
    `Preis: ${p.preis} €. Energieklasse ${p.energieausweis}.`;

  const { gueltig, gruende } = pruefe(text, p);
  assert.equal(gueltig, true, `unerwartet beanstandet: ${gruende}`);
});

test("Die Provision darf im Inserat stehen", () => {
  // Der schädlichste Fall der Liste, solange er offen war: die Provision galt
  // als unbelegte Zahl, also hätte der Writer gelernt, eine in Deutschland
  // vorgeschriebene Angabe wegzulassen. Ein Vertrag, der das antrainiert, ist
  // schlimmer als gar keiner.
  const p = objekt("P01");
  const text =
    `${p.objektart} in ${p.adresse}. 82,5 m², ${p.zimmer} Zimmer. ` +
    `Preis: ${p.preis} €. Energieklasse ${p.energieausweis}. ` +
    `Provision: ${p.provision}`;

  const { gueltig, gruende } = pruefe(text, p);
  assert.equal(gueltig, true, `unerwartet beanstandet: ${gruende}`);
});

test("Ein leeres Nicht-Zahlenfeld darf nicht behauptet werden", () => {
  // P10 hat keinen Energieausweis. „Energieklasse B" ist erfunden — und weil B
  // keine Ziffer ist, sah der Zahlenvergleich sie grundsätzlich nicht.
  const p = objekt("P10");
  const { gruende } = pruefe(
    `${p.objektart} in ${p.adresse}. Energieklasse B.`,
    p,
  );
  assert.ok(
    gruende.includes('Energieausweis "B" behauptet, das Feld ist leer'),
    gruende,
  );
});

test("Ein gefülltes Energiefeld muss im Text stehen und stimmen", () => {
  const p = objekt("P01");
  const ohne = pruefe(`${p.objektart} in ${p.adresse}.`, p);
  assert.ok(
    ohne.gruende.includes('Energieausweis "B" fehlt im Text'),
    ohne.gruende,
  );

  const falsch = pruefe(`${p.objektart} in ${p.adresse}. Energieklasse D.`, p);
  assert.ok(
    falsch.gruende.includes('Energieausweis "D" statt "B"'),
    falsch.gruende,
  );
});

test("Ein erfundenes Zahlwort wird erkannt", () => {
  // Zahlwörter sind der einfachste Weg, an einem reinen Ziffernvergleich
  // vorbeizukommen: „fünf Minuten zur Bahn" enthält keine Ziffer.
  const p = objekt("P03");
  const { gruende } = pruefe(
    `${p.objektart} in ${p.adresse}. fünf Minuten zur Bahn.`,
    p,
  );
  assert.ok(gruende.includes('ausgeschriebene Zahl "fünf"'), gruende);
});

test("Ein leeres Feld erlaubt keinen Wert — auch keinen plausiblen", () => {
  // P09 hat keine Etage. Die Vertragsregel aus der Kundenerkundung §1 sagt:
  // auslassen oder markieren, nie erfinden. Hier zählt, DASS das Tor greift.
  const p = objekt("P09");
  const { gruende } = pruefe(`Etage 6. OG, ${p.wohnflaeche_m2} m².`, p);
  assert.ok(gruende.includes('unbelegte Zahl "6"'), gruende);
});

test("Alle zehn Datensätze sind maschinell verwendbar", () => {
  // Die Umrechnung der Dokumenttabelle (82,5 m² / 449.000 € / 2. OG) in
  // Zahlen ist der Ort, an dem still etwas kaputtgehen kann. Deshalb einmal
  // hart prüfen, statt es in jedem anderen Test vorauszusetzen.
  assert.equal(portfolio.objekte.length, 10);
  for (const p of portfolio.objekte) {
    assert.equal(typeof p.wohnflaeche_m2, "number", `${p.id}: Wohnfläche`);
    assert.equal(typeof p.zimmer, "number", `${p.id}: Zimmer`);
    assert.equal(typeof p.preis, "number", `${p.id}: Preis`);
    assert.equal(
      typeof p.fotos,
      "number",
      `${p.id}: Fotos (Anzahl, kein Array)`,
    );
    assert.ok(["kauf", "miete"].includes(p.preisTyp), `${p.id}: PreisTyp`);
    assert.ok(
      p.adresse && p.objektart && p.beschreibung,
      `${p.id}: Pflichttext`,
    );
  }
});

// ── portfolioLoader ──────────────────────────────────────────────────────

test("portfolioLoader findet das Objekt über seine ID", () => {
  const r = portfolioLoaderNode({
    task: "Erstelle Inserate für Objekt OBJ-001.",
  });
  assert.equal(r.property.id, "OBJ-001");
  assert.equal(r.nextAgent, "orchestrator");
});

test("portfolioLoader erkennt auch die IDs des Kundendatensatzes", () => {
  // Das Muster verlangte zwei Großbuchstaben UND einen Bindestrich; die
  // Kundendaten heißen P01..P10 und passten nicht. Erkannt wird die ID jetzt —
  // gefunden wird sie nicht, weil die Entwicklungs-Fixture nur OBJ-001 kennt.
  // Genau das muss der Lauf sagen, statt still etwas anderes zu laden.
  const r = portfolioLoaderNode({ task: "Erstelle Inserate für Objekt P01." });
  assert.equal(r.property, undefined);
  assert.match(r.portfolioFehler, /P01/);
});

test("Eine unbekannte ID bricht ab, statt still das falsche Objekt zu laden", () => {
  // Vorher fiel der Loader auf den ersten Datensatz zurück. Ein Inserat für
  // das FALSCHE Objekt geht an ein Portal und trägt einen echten Preis; ein
  // abgebrochener Lauf kostet eine Minute. Fail-closed, wie an der
  // Genehmigungskante (T2.3).
  const r = portfolioLoaderNode({ task: "Erstelle Inserate für Objekt XYZ-999." });
  assert.equal(r.property, undefined);
  assert.match(r.portfolioFehler, /XYZ-999/);
});

test("Ohne Objekt-ID wird gar nicht erst geladen", () => {
  const r = portfolioLoaderNode({ task: "Mach mal ein Inserat." });
  assert.equal(r.property, undefined);
  assert.match(r.portfolioFehler, /keine Objekt-ID/);
});

// ── listingStore und delivery ────────────────────────────────────────────

test("listingStore stellt auf AWAITING_APPROVAL und löst damit die HITL-Bremse aus", () => {
  const r = listingStoreNode({
    threadId: "immo-store-1",
    property: objekt("P02"),
    listings: { immoscout24: "Text" },
  });
  assert.equal(r.staged, true, "staged=true ist das Signal für BREMSE2");
  assert.equal(getListingArtifact("immo-store-1").status, "AWAITING_APPROVAL");

  markDelivered("immo-store-1");
  assert.equal(getListingArtifact("immo-store-1").status, "DELIVERED");
});

test("delivery reiht je Portal genau eine Aktion ein — auch beim zweiten Lauf", () => {
  // Der Fall aus ADR-0026 an der Stelle, an der er wirklich auftritt: ein
  // zweiter Klick auf Genehmigen darf kein zweites Inserat erzeugen.
  const state = {
    threadId: "immo-delivery-1",
    listings: { immoscout24: "A", immowelt: "B", kleinanzeigen: "C" },
  };
  const vorher = getQueue().length;

  deliveryNode(state);
  assert.equal(getQueue().length, vorher + 3);

  deliveryNode(state);
  assert.equal(
    getQueue().length,
    vorher + 3,
    "Der zweite Durchlauf darf nichts hinzufügen",
  );
});

// ── Der ganze Ablauf, nicht nur seine Teile ──────────────────────────────

test("Ein unbekanntes Objekt beendet den Lauf, statt ihn zu drehen", async () => {
  // BREMSE1b ist neu, und ihr Ausfallmodus wäre der schlimmste: ohne sie
  // schickt BREMSE4 („kein Objekt → laden") den Lauf endlos im Kreis, bis das
  // Rekursionslimit greift — genau der Defekt, mit dem dieses Repo in Phase 0
  // angefangen hat. Ein Unit-Test am Loader beweist das NICHT; nur ein echter
  // Lauf durch den Graphen tut es.
  await import("../src/domains/immobilien/domain.js");
  const { getRunner } = await import("../src/kernel/registry.js");
  const { startWorkflow } = getRunner("immobilien");

  const threadId = "immo-unbekannt";
  const { interrupted } = await startWorkflow({
    task: "Erstelle Inserate für Objekt ZZZ-404.",
    threadId,
  });

  assert.equal(interrupted, false, "kein Halt am Genehmigungstor");
  assert.equal(
    getListingArtifact(threadId),
    null,
    "nichts gespeichert, also gibt es auch nichts zu genehmigen",
  );
});
