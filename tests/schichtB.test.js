// ── tests/schichtB.test.js ───────────────────────────────────────────────
// Prüft das MESSINSTRUMENT der Schicht B, nicht das Modell.
//
// Die Unterscheidung ist der ganze Punkt dieser Datei. Was ein echtes Modell
// schreibt, kann ohne Schlüssel niemand messen — das ist keine Lücke, sondern
// die Definition von Schicht B (ADR-0008, ADR-0019). Was sehr wohl ohne
// Schlüssel prüfbar ist: ob der Harness, gefüttert mit bekannten Texten, die
// RICHTIGEN Zahlen ausgibt.
//
// Ohne diese Datei war der einzige Beleg für `quality.js` ein Lauf gegen einen
// ungültigen Schlüssel, der „nicht messbar (0/0)" ergab. Ein Instrument, von
// dem man nur weiß, dass es nichts anzeigen kann, ist kein Instrument. Hier
// steht der Gegenbeweis: mit einem Skript-Writer erzeugt derselbe Code grüne,
// gelbe und rote Ergebnisse — und die beiden Zahlen aus ADR-0030 gehen
// auseinander, wie sie sollen.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { frischerZustand } from "./helpers/zustand.js";

frischerZustand();
process.env.TRACE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "trace-schichtb-"),
);

const { messeEntwuerfe } = await import("../evals/runners/messung.js");
const { vertragskonformitaet } = await import("../evals/metrics/index.js");

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

// ── Ein Skript-Writer statt eines Modells ────────────────────────────────
// `drehbuch` sagt je Fall, welche Versuche konform sind. Damit ist jeder Pfad
// der Schleife gezielt ansteuerbar — ohne Netz, ohne Kosten, ohne Streuung.
function skriptWriter(drehbuch, { maxVersuche = 5 } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    maxVersuche,
    async schreibe(gegenstand, variante, feedback) {
      const eintrag = { id: gegenstand.id, variante, feedback };
      aufrufe.push(eintrag);
      const plan = drehbuch[gegenstand.id];
      if (plan.wirft) throw new Error("Modellfehler (simuliert)");
      const n = aufrufe.filter(
        (a) => a.id === gegenstand.id && a.variante === variante,
      ).length;
      return `Text ${gegenstand.id}/${variante} Versuch ${n}`;
    },
    pruefe(text, gegenstand) {
      const plan = drehbuch[gegenstand.id];
      const versuch = Number(text.match(/Versuch (\d+)$/)[1]);
      const konform = plan.konformAb !== null && versuch >= plan.konformAb;
      return {
        konform,
        gruende: konform ? "" : `unbelegte Zahl "${versuch}"`,
      };
    },
  };
}

const gratis = () => 0;

// ── Die drei Wege durch die Schleife ─────────────────────────────────────

test("Erstversuch konform: ein Aufruf, beide Zahlen grün", async () => {
  const b = skriptWriter({ A: { konformAb: 1 } });
  const { entwuerfe, abgebrochen } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(abgebrochen, null);
  assert.equal(entwuerfe.length, 1);
  assert.equal(entwuerfe[0].versuche, 1, "kein zweiter Schreibversuch");
  assert.equal(entwuerfe[0].konformImErstenVersuch, true);
  assert.equal(entwuerfe[0].konformAmEnde, true);
  assert.equal(b.aufrufe.length, 1);
});

test("Erst nach Revision konform: T8 rot, nachRevision grün", async () => {
  // Der Fall, für den ADR-0030 überhaupt entstanden ist. Wer nach der
  // Schleife zählt, sieht hier 100 % und hält den Writer für fehlerfrei.
  const b = skriptWriter({ A: { konformAb: 2 } });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe[0].versuche, 2);
  assert.equal(entwuerfe[0].konformImErstenVersuch, false, "T8 muss rot sein");
  assert.equal(entwuerfe[0].konformAmEnde, true);
  assert.match(entwuerfe[0].gruendeErsterVersuch, /unbelegte Zahl/);

  // Das Feedback des Tors muss beim zweiten Schreiben tatsächlich ankommen —
  // sonst misst „nachRevision" nur, dass ein zweiter Wurf zufällig traf.
  assert.equal(b.aufrufe[0].feedback, "");
  assert.match(b.aufrufe[1].feedback, /unbelegte Zahl/);
});

test("Nie konform: die Schleife stoppt am Revisionslimit", async () => {
  const b = skriptWriter({ A: { konformAb: null } }, { maxVersuche: 3 });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe[0].versuche, 3, "genau maxVersuche, nicht mehr");
  assert.equal(entwuerfe[0].konformImErstenVersuch, false);
  assert.equal(entwuerfe[0].konformAmEnde, false);
});

// ── Die beiden Schutzmechanismen ─────────────────────────────────────────

test("Ein Modellfehler beendet den Lauf nicht", async () => {
  // Was bereits gemessen wurde, ist bezahlt und gehört in den Bericht.
  const b = skriptWriter({
    A: { konformAb: 1 },
    B: { wirft: true },
    C: { konformAb: 1 },
  });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  assert.equal(entwuerfe.length, 3, "C wurde trotz des Fehlers bei B gemessen");
  assert.match(entwuerfe[1].fehler, /simuliert/);
  assert.equal(entwuerfe[1].text, null);
  assert.equal(entwuerfe[2].konformImErstenVersuch, true);
});

test("Die Ausgabengrenze greift VOR dem nächsten Aufruf", async () => {
  // Eine Grenze, die erst nach dem Ausgeben greift, ist keine Grenze.
  let verbraucht = 0;
  const b = skriptWriter({
    A: { konformAb: 1 },
    B: { konformAb: 1 },
    C: { konformAb: 1 },
  });
  const teuer = {
    ...b,
    async schreibe(...args) {
      verbraucht += 0.4;
      return b.schreibe(...args);
    },
  };

  const { entwuerfe, abgebrochen } = await messeEntwuerfe({
    schichtB: teuer,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 0.5,
    verbrauch: () => verbraucht,
  });

  assert.equal(
    entwuerfe.length,
    2,
    "nach 0,8 USD wird der dritte nicht mehr gefahren",
  );
  assert.match(abgebrochen, /Ausgabengrenze erreicht/);
});

// ── Die Metrik: die beiden Zahlen müssen auseinandergehen ────────────────

test("3.8 zählt den ersten Versuch, nachRevision das Ende (ADR-0030)", async () => {
  const b = skriptWriter({
    A: { konformAb: 1 }, // sofort konform
    B: { konformAb: 2 }, // erst nach Revision
    C: { konformAb: null }, // nie
  });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: ["A", "B", "C"].map((id) => ({ id, gegenstand: { id } })),
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  const m = vertragskonformitaet(entwuerfe);
  assert.equal(m["3.8"].zaehler, 1, "nur A war im ersten Versuch konform");
  assert.equal(m["3.8"].nenner, 3);
  assert.equal(m["3.8"].erfuellt, false, "T8 ist rot — und muss es hier sein");
  assert.equal(m.nachRevision.zaehler, 2, "A und B nach der Schleife");
  assert.notEqual(
    m["3.8"].wert,
    m.nachRevision.wert,
    "gingen beide Zahlen nie auseinander, wäre die Unterscheidung folgenlos",
  );
  assert.equal(m.verletzungen.length, 2);
});

test("Ohne Entwurf ist die Metrik nicht messbar, nicht 100 %", async () => {
  // Die Nenner-Probe aus EVALS.md §7 an der Stelle, an der sie zuschlägt:
  // ein Lauf, in dem jeder Modellaufruf scheitert, darf nicht grün melden.
  const b = skriptWriter({ A: { wirft: true } });
  const { entwuerfe } = await messeEntwuerfe({
    schichtB: b,
    faelle: [{ id: "A", gegenstand: { id: "A" } }],
    varianten: ["portal1"],
    maxUsd: 1,
    verbrauch: gratis,
  });

  const m = vertragskonformitaet(entwuerfe);
  assert.equal(m["3.8"].nenner, 0);
  assert.equal(
    m["3.8"].wert,
    null,
    "kein Prozentwert aus einem Nenner von null",
  );
  assert.equal(m["3.8"].erfuellt, null, "weder bestanden noch gefallen");
});

// ── Der echte Adapter, im Mock-Modus ─────────────────────────────────────
// Hier wird NICHT der Writer gemessen (im Mock baut er seinen Text aus dem
// Datensatz), sondern die Verdrahtung: trifft `schreibe` das gewünschte
// Portal, und meldet `pruefe` einen bekannten Verstoß?

test("schichtB.schreibe liefert den Text des ANGEFRAGTEN Portals", async () => {
  const { adapter } = await import("../evals/domains/immobilien/adapter.js");
  const objekt = lies("portfolio.json").objekte.find((o) => o.id === "P04");

  // Das mittlere Portal: der Writer wählt das erste fehlende, also müssen die
  // davorliegenden belegt sein. Genau hier ginge eine stille Verwechslung
  // unter — gemessen würde dann dreimal dasselbe Portal.
  const zweites = adapter.schichtB.varianten[1];
  const text = await adapter.schichtB.schreibe(objekt, zweites, "");

  assert.equal(typeof text, "string");
  assert.ok(text.length > 0, "leerer Text wäre als Entwurf gezählt worden");
  assert.ok(text.includes(objekt.adresse), "der Datensatz muss im Text stehen");
});

test("schichtB.pruefe meldet einen bekannten Verstoß — der Weg kann rot", async () => {
  const { adapter } = await import("../evals/domains/immobilien/adapter.js");
  const negativ = lies("negative-listings.json");
  const portfolio = lies("portfolio.json");

  // N01: erfundene Fahrtzeit. Derselbe Fall, den tests/immobilien.test.js am
  // Knoten prüft — hier über den Schicht-B-Weg, damit belegt ist, dass die
  // Messung einen Verstoß auch wirklich bis in die Metrik trägt.
  const fall = negativ.faelle.find((f) => f.id === "N01");
  const objekt = portfolio.objekte.find((o) => o.id === fall.datensatz);

  const urteil = adapter.schichtB.pruefe(fall.text, objekt);
  assert.equal(urteil.konform, false);
  for (const grund of fall.erwartet.gruende) {
    assert.ok(
      urteil.gruende.includes(grund),
      `${grund}\nGemeldet: ${urteil.gruende}`,
    );
  }
});
