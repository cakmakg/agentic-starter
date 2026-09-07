// ── domains/immobilien/agents/listingWriter.js ───────────────────────────
// Produzierender Agent — die "produzierende" Seite der Revisionsschleife
// listingWriter ⇄ contractChecker (wie writer ⇄ critic in domains/report).
//
// Schreibt EIN Portal je Aufruf: das fehlende zuerst. Nach einer Ablehnung
// durch den contractChecker entfernt dieser das betroffene Portal aus
// state.listings — dadurch gilt es hier wieder als "fehlend" und wird neu
// geschrieben, mit dem Prüf-Feedback im Prompt.
//
// ERHÖHT revisionCount bei jedem Aufruf (Schutzschalter, wie bei writer.js).
//
// Mock-Modus (T2.5-Fund, durch Ausführen entdeckt): kernel/llm/mock.js liefert
// bewusst eine INHALTSBLINDE Fake-Antwort (siehe deren Kopfkommentar). Der
// contractChecker dieser Domäne ist aber deterministisch content-aware — die
// generische Mock-Antwort kann seinen Vertrag NIE erfüllen und der Lauf liefe
// jedes Mal ins Revisionslimit. llmStructured hat für genau diesen Fall einen
// domänen-eigenen `mockFactory`-Haken; llmText hat keinen. Deshalb ersetzt die
// Domäne hier selbst die Mock-Antwort durch eine vertragskonforme, aus
// state.property gebaute — ohne den Kern anzufassen (T10).

import { llmText } from "../../../kernel/llm/adapter.js";
import { MOCK_LLM } from "../../../kernel/config/env.js";
import { prompts } from "../prompts.js";

export const TARGET_PORTALS = ["immoscout24", "immowelt", "kleinanzeigen"];

export async function listingWriterNode(state) {
  const portal = TARGET_PORTALS.find((p) => !state.listings[p]);
  const raw = await llmText(
    prompts.listingWriter.system(portal),
    prompts.listingWriter.user(state, portal),
  );
  const text = MOCK_LLM
    ? buildMockListing(state.property, portal)
    : String(raw);

  return {
    listings: { ...state.listings, [portal]: text },
    revisionCount: 1,
    isContractValid: null, // neues/geändertes Inserat → contractChecker muss erneut prüfen
    nextAgent: "orchestrator",
    log: [`✍️ listingWriter: Inserat für ${portal} erstellt`],
  };
}

function buildMockListing(property, portal) {
  const teile = [
    property.objektart,
    `in ${property.adresse}.`,
    `${property.wohnflaeche_m2} m², ${property.zimmer} Zimmer.`,
    `Preis: ${property.preis} €.`,
    property.beschreibung,
  ];
  if (property.baujahr) teile.push(`Baujahr ${property.baujahr}.`);
  // Pflicht, sobald das Feld gefüllt ist (ADR-0028, Vertragssatz 4): der
  // Energieausweis ist keine Zahl, also prüft ihn der contractChecker eigens.
  if (property.energieausweis)
    teile.push(`Energieklasse ${property.energieausweis}.`);
  if (property.etage) teile.push(`Etage ${property.etage}.`);
  if (property.stellplatz) teile.push(`${property.stellplatz} Stellplatz.`);
  if (property.fotos) teile.push(`${property.fotos} Fotos.`);
  // KEIN Portalname im Text (auch nicht im Log-Präfix): "ImmoScout24" trägt
  // selbst eine Zahl, die der Vertrag sonst fälschlich als unbelegt ablehnt —
  // durch Ausführen gefunden (siehe Kopfkommentar dieser Datei).
  return `[MOCK] ${teile.filter(Boolean).join(" ")}`;
}
