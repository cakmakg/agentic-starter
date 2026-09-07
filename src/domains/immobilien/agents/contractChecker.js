// ── domains/immobilien/agents/contractChecker.js ─────────────────────────
// Das QA-Tor der Domäne `immobilien` — deterministisch (KEIN LLM). Prüft den
// Ausgabevertrag (T8, EVALS.md §3.8).
//
// Gründerlektion (wie bei critic.js): TRENNE den Produzenten (listingWriter)
// vom Prüfer. Ein Zahlen- und Feldvergleich lässt sich nicht "überreden" —
// anders als ein LLM, das seine eigene Arbeit gut findet.
//
// ── DER VERTRAG, in vier Sätzen (ADR-0028) ──────────────────────────────
//
//   1) BELEGT ist eine Zahl, die in einem Feld des Datensatzes steht — auch in
//      einem TEXTfeld. Die Beschreibung hat die Kundin oder der Kunde selbst
//      geschrieben; sie zu zitieren ist kein Erfinden. Steht dort "mit zwei
//      Balkonen", darf das Inserat zwei Balkone nennen.
//   2) LEER heißt auslassen. Für ein leeres Feld darf kein Wert entstehen —
//      weder als Zahl noch als Buchstabe. Kein "nicht angegeben"-Vermerk: die
//      Regel ist rein negativ und dadurch prüfbar, ohne dass der Writer alle
//      fehlenden Felder aufzählen müsste.
//   3) PROVISION ist belegt und gehört ins Inserat. Sie steht als Textfeld im
//      Datensatz; sie als "unbelegte Zahl" abzulehnen hieße, dem Writer das
//      Weglassen einer in Deutschland vorgeschriebenen Angabe anzutrainieren.
//   4) ENERGIEAUSWEIS wird eigens geprüft, weil er kein Zahlenfeld ist: ist er
//      gefüllt, muss die Klasse im Text stehen und stimmen; ist er leer, darf
//      keine behauptet werden.
//
// GRENZE, ausdrücklich: dieses Tor prüft HERKUNFT, nicht Wahrheit. Ist die
// Beschreibung der Kundin oder des Kunden falsch, erbt das Inserat den Fehler.
// Die Daten des Kunden zu bestreiten ist nicht Aufgabe dieses Systems.

// Felder, deren WERT eine Zahl ist.
const NUMERIC_FIELDS = [
  "wohnflaeche_m2",
  "zimmer",
  "preis",
  "baujahr",
  "etage",
  "stellplatz",
  "fotos",
];

// Vom Kunden gelieferte TEXTfelder. Zahlen darin sind belegt (Vertragssatz 1).
const BELEG_TEXT_FIELDS = ["adresse", "objektart", "beschreibung", "provision"];

const REQUIRED_TEXT_FIELDS = ["adresse", "objektart"];
const REQUIRED_NUMERIC_FIELDS = ["wohnflaeche_m2", "zimmer", "preis"];

// "ein"/"eine" fehlen bewusst: sie sind im Deutschen fast immer der unbestimmte
// Artikel ("ein Balkon") und nicht die Menge 1. Sie mitzuzählen erzeugte
// Falschvorwürfe im Dutzend — und Falschvorwürfe trainieren dem Writer genau
// die Auslassungen an, die dieser Vertrag verhindern soll.
const ZAHLWORT = {
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
};
const ZAHLWORT_MUSTER = new RegExp(
  `\\b(${Object.keys(ZAHLWORT).join("|")})\\b`,
  "gi",
);

// Energieangabe als eigenes Muster, weil sie ein BUCHSTABE ist — der
// Zahlenvergleich kann sie grundsätzlich nicht sehen.
const ENERGIE_MUSTER =
  /energie(?:ausweis|klasse|effizienzklasse)\s*:?\s*([A-H])\b/i;

// Deutsche Schreibweisen: 449.000 · 82,5 · 695 000 · 2.150.
// Erste Alternative: Tausendergruppen. Zweite: einfache Zahl mit optionaler
// Dezimalstelle. Die Reihenfolge ist wichtig — sonst zerfiele 449.000 in zwei.
const ZAHL_MUSTER = /\d+(?:[.,]\d{3})+(?![\d,.])|\d+(?:[.,]\d+)?/g;

// Tausendertrennzeichen können Leerzeichen sein — auch das geschützte (U+00A0)
// und das schmale (U+202F), die aus Textverarbeitungen stammen. `\s` deckt sie
// ab: es schließt die Unicode-Kategorie Zs ein. Sie hier zusätzlich als
// Literal aufzuführen brächte nichts und stellte unsichtbare Zeichen in den
// Quelltext — dieselbe Falle, die in dieser Sitzung schon einmal zuschlug.
const TRENN_LEERZEICHEN = /\s/g;

// Bringt Feldwert und Textfund auf dieselbe Form.
//
// Ein Zahlenwert (82.5) kommt schon richtig aus JavaScript und wird NICHT
// angefasst. Zuvor lief er durch dieselbe Punkt-Entfernung wie ein Text und
// wurde zu "825" — die eigene Wohnfläche des Objekts galt damit als unbelegt.
// Gefunden über den Randfall "Dezimalfläche mit Komma" aus der Kundenerkundung.
function normalizeNumber(raw) {
  if (typeof raw === "number") return String(raw);
  const s = String(raw).replace(TRENN_LEERZEICHEN, "");
  // Im Deutschen ist das Komma immer das Dezimalzeichen; Punkte davor trennen
  // Tausender.
  if (s.includes(",")) return s.replace(/\./g, "").replace(",", ".");
  // Nur Punkte, und sie gruppieren exakt zu dritt → Tausendertrennzeichen.
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) return s.replace(/\./g, "");
  return s;
}

function extractNumbers(text) {
  // Leerzeichen zwischen Ziffern zusammenziehen, wenn rechts genau eine
  // Dreiergruppe folgt: "695 000" ist eine Zahl, "5 Minuten" nicht.
  const t = String(text).replace(/(\d)\s(?=\d{3}(?!\d))/g, "$1");
  return (t.match(ZAHL_MUSTER) || []).map(normalizeNumber);
}

function extractZahlwoerter(text) {
  return (String(text).match(ZAHLWORT_MUSTER) || []).map((w) =>
    String(ZAHLWORT[w.toLowerCase()]),
  );
}

// Die Menge der belegten Zahlen: aus den Zahlenfeldern UND aus den Textfeldern
// des Kunden, Ziffern wie Zahlwörter.
function allowedNumbers(property) {
  const erlaubt = new Set();
  for (const feld of NUMERIC_FIELDS) {
    const wert = property[feld];
    if (wert !== null && wert !== undefined) erlaubt.add(normalizeNumber(wert));
  }
  for (const feld of BELEG_TEXT_FIELDS) {
    const text = property[feld];
    if (!text) continue;
    for (const n of extractNumbers(text)) erlaubt.add(n);
    for (const n of extractZahlwoerter(text)) erlaubt.add(n);
  }
  return erlaubt;
}

function checkListing(text, property) {
  const reasons = [];
  const erlaubt = allowedNumbers(property);
  const zahlenImText = extractNumbers(text);

  for (const n of zahlenImText) {
    if (!erlaubt.has(n)) reasons.push(`unbelegte Zahl "${n}"`);
  }

  // Zahlwörter sind der einfachste Weg, an einem reinen Ziffernvergleich
  // vorbeizukommen — "fünf Minuten zur Bahn" enthält keine Ziffer.
  for (const treffer of String(text).match(ZAHLWORT_MUSTER) || []) {
    const wert = String(ZAHLWORT[treffer.toLowerCase()]);
    if (!erlaubt.has(wert)) {
      reasons.push(`ausgeschriebene Zahl "${treffer.toLowerCase()}"`);
    }
  }

  for (const feld of REQUIRED_TEXT_FIELDS) {
    const wert = String(property[feld] || "");
    if (wert && !text.toLowerCase().includes(wert.toLowerCase())) {
      reasons.push(`Pflichtfeld "${feld}" fehlt im Text`);
    }
  }

  for (const feld of REQUIRED_NUMERIC_FIELDS) {
    const wert = property[feld];
    if (!zahlenImText.includes(normalizeNumber(wert))) {
      reasons.push(`Pflichtfeld "${feld}" (${wert}) fehlt im Text`);
    }
  }

  reasons.push(...checkEnergieausweis(text, property.energieausweis));
  return reasons;
}

// Vertragssatz 4. Zwei Richtungen, dieselbe Regel: der Text darf genau das
// behaupten, was im Feld steht — nicht mehr und nicht weniger.
function checkEnergieausweis(text, wert) {
  const treffer = String(text).match(ENERGIE_MUSTER);
  const behauptet = treffer ? treffer[1].toUpperCase() : null;

  if (!wert) {
    return behauptet
      ? [`Energieausweis "${behauptet}" behauptet, das Feld ist leer`]
      : [];
  }
  if (!behauptet) return [`Energieausweis "${wert}" fehlt im Text`];
  if (behauptet !== String(wert).toUpperCase()) {
    return [`Energieausweis "${behauptet}" statt "${wert}"`];
  }
  return [];
}

export function contractCheckerNode(state) {
  const violations = {};
  for (const [portal, text] of Object.entries(state.listings)) {
    const reasons = checkListing(text, state.property);
    if (reasons.length) violations[portal] = reasons;
  }

  if (Object.keys(violations).length === 0) {
    return {
      isContractValid: true,
      contractFeedback: "",
      nextAgent: "orchestrator",
      log: ["📐 contractChecker: Vertrag erfüllt (T8) — alle Zahlen belegt"],
    };
  }

  // Betroffene Portale entfernen: BREMSE5 sieht sie danach als "fehlend" und
  // listingWriter schreibt sie mit dem Feedback neu.
  const remainingListings = { ...state.listings };
  for (const portal of Object.keys(violations))
    delete remainingListings[portal];

  return {
    listings: remainingListings,
    isContractValid: false,
    contractFeedback: Object.entries(violations)
      .map(([portal, reasons]) => `${portal}: ${reasons.join("; ")}`)
      .join(" | "),
    nextAgent: "orchestrator",
    log: [
      `📐 contractChecker: Vertrag verletzt → Revision (${Object.keys(violations).join(", ")})`,
    ],
  };
}
