// ── domains/immobilien/data/portfolioFixture.js ──────────────────────────
// ENTWICKLUNGS-FIXTURE — KEIN echter Portfolio-Datensatz. Sie macht den
// goldenen Pfad lauffähig, solange kein echter Datensatz eingebunden ist.
//
// Felder und deren Pflicht-/Füllgrad-Status stammen aus der echten
// Kundenerkundung (docs/kundenerkundung-immobilien.md §1) — nur die WERTE
// hier sind frei erfunden. T12 verlangt einen ECHTEN, von einer Beraterin
// oder einem Berater genehmigten Lauf; diese Fixture erfüllt T12 NICHT.

export const portfolioFixture = [
  {
    id: "OBJ-001",
    adresse: "Musterstraße 12, 10115 Berlin",
    wohnflaeche_m2: 82,
    zimmer: 3,
    preis: 450000,
    preisTyp: "kauf",
    objektart: "Etagenwohnung",
    beschreibung: "Helle 3-Zimmer-Wohnung mit Balkon in ruhiger Lage.",
    fotos: 14,
    baujahr: 1998,
    energieausweis: "B",
    etage: 3,
    stellplatz: 1,
    provision: "3,57 % inkl. MwSt.",
    grundriss: true,
  },
];
