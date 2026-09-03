// ── domains/immobilien/agents/contractChecker.js ─────────────────────────
// Das QA-Tor der Domäne `immobilien` — überwiegend deterministisch (KEIN LLM).
// Prüft den Ausgabevertrag (T8, EVALS.md §3.8): JEDE Zahl im Inserat muss
// buchstabengleich aus einem Feld des Portfolio-Datensatzes stammen, und die
// Pflichtfelder aus docs/kundenerkundung-immobilien.md §1 müssen vorkommen.
//
// Gründerlektion (wie bei critic.js): TRENNE den Produzenten (listingWriter)
// vom Prüfer. Ein reiner Teilstring-/Zahlenvergleich lässt sich nicht
// "überreden" — anders als ein LLM, das seine eigene Arbeit gut findet.

const REQUIRED_TEXT_FIELDS = ["adresse", "objektart"];
const REQUIRED_NUMERIC_FIELDS = ["wohnflaeche_m2", "zimmer", "preis"];

function normalizeNumber(raw) {
  return String(raw).replace(/\./g, "").replace(",", ".");
}

function extractNumbers(text) {
  return (String(text).match(/\d+(?:[.,]\d+)?/g) || []).map(normalizeNumber);
}

function allowedNumbers(property) {
  const numericFields = [
    property.wohnflaeche_m2,
    property.zimmer,
    property.preis,
    property.baujahr,
    property.etage,
    property.stellplatz,
    property.fotos,
  ];
  const fromFields = numericFields
    .filter((v) => v !== null && v !== undefined)
    .map((v) => normalizeNumber(v));
  const fromAddress = extractNumbers(property.adresse); // z. B. Postleitzahl
  return new Set([...fromFields, ...fromAddress]);
}

function checkListing(text, property) {
  const reasons = [];
  const allowed = allowedNumbers(property);

  for (const n of extractNumbers(text)) {
    if (!allowed.has(n)) reasons.push(`unbelegte Zahl "${n}"`);
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    const value = String(property[field] || "");
    if (value && !text.toLowerCase().includes(value.toLowerCase())) {
      reasons.push(`Pflichtfeld "${field}" fehlt im Text`);
    }
  }
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    const value = property[field];
    const norm = normalizeNumber(value);
    if (!extractNumbers(text).includes(norm)) {
      reasons.push(`Pflichtfeld "${field}" (${value}) fehlt im Text`);
    }
  }
  return reasons;
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
