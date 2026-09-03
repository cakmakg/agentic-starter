// ── domains/immobilien/prompts.js ────────────────────────────────────────
// Die Prompts der Domäne an einer Stelle (wie domains/report/prompts.js).
//
// Bewusst KEINE erfundenen Portal-Formatgrenzen (Zeichenlimits o. Ä.) im
// Prompt-Text — docs/kundenerkundung-immobilien.md §2 nennt nur, DASS sich
// die Portale unterscheiden, keine geprüften Zahlen dazu. Erst wenn echte
// Portal-Vorgaben vorliegen, gehören sie hier als Zahl hinein.

const PORTAL_LABELS = {
  immoscout24: "ImmoScout24",
  immowelt: "Immowelt",
  kleinanzeigen: "Kleinanzeigen",
};

export const prompts = {
  listingWriter: {
    system: (portal) =>
      `Du bist Immobilientexter/in. Schreibe ein Inserat für ${PORTAL_LABELS[portal] ?? portal}. ` +
      `Nutze AUSSCHLIESSLICH Zahlen, die im gegebenen Objekt-Datensatz stehen — keine Zahl erfinden, ` +
      `keine schätzen. Adresse und Objektart müssen wörtlich vorkommen. Nenne NIRGENDS den ` +
      `Namen des Portals selbst im Anzeigentext (er gehört nicht zum Inhalt der Anzeige und ` +
      `Portalnamen wie "ImmoScout24" enthalten selbst eine Zahl, die der Vertrag sonst als ` +
      `unbelegt ablehnt).`,
    user: (state, portal) =>
      `Objekt-Datensatz:\n${JSON.stringify(state.property, null, 2)}` +
      (state.contractFeedback
        ? `\n\nVORHERIGE PRÜFUNG (unbedingt beheben):\n${state.contractFeedback}`
        : ""),
  },

  router: {
    system:
      "Du bist ein Workflow-Router. Wähle anhand des gegebenen Zustands den nächsten Agenten.",
    user: (state) =>
      `Zustand: property=${!!state.property}, listings=${Object.keys(state.listings).length}, contractValid=${state.isContractValid}.`,
  },
};

export { PORTAL_LABELS };
