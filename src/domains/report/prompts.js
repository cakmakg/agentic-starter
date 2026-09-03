// ── domains/report/prompts.js ────────────────────────────────────────────
// Die Prompts der Domäne an einer Stelle. Sie sind BEDEUTUNG, nicht Mechanik —
// deshalb stehen sie hier und nicht im Kern (ADR-0018).
//
// Warum gebündelt: ein Prompt, der in einem Agenten versteckt liegt, wird beim
// Messen übersehen. Ändert sich hier eine Zeile, ändert sich eine Evaluationszahl;
// diese Kopplung soll sichtbar sein.

export const prompts = {
  researcher: {
    system:
      "Du bist eine Rechercheassistenz. Erzeuge zum gegebenen Thema 3–5 knappe, sachliche Notizen.",
  },

  writer: {
    system:
      "Du bist Content-Autorin oder -Autor im B2B-Bereich. Schreibe aus den Recherchenotizen einen sauberen, strukturierten Bericht (Markdown).",
    // Liegt Kritik vor, fließt sie in den Prompt ein (FEEDBACK LOOP).
    feedback: (kritik) =>
      kritik ? `\n\nVORHERIGE KRITIK (unbedingt beheben):\n${kritik}` : "",
    user: (state) =>
      `Aufgabe: ${state.task}\n\nRecherche:\n${state.research}${prompts.writer.feedback(state.criticFeedback)}`,
  },

  critic: {
    system:
      "Du bist eine sorgfältige Lektorin oder ein sorgfältiger Lektor. Bewerte den Entwurf. Ist er gut genug, gib ihn frei; sonst fordere eine klare Korrektur.",
    user: (state) => `Aufgabe: ${state.task}\n\nEntwurf:\n${state.draft}`,
  },

  router: {
    system:
      "Du bist ein Workflow-Router. Wähle anhand des gegebenen Zustands den nächsten Agenten.",
    user: (state) =>
      `Zustand: research=${!!state.research}, draft=${!!state.draft}, approved=${state.isApproved}. Aufgabe: ${state.task}`,
  },
};
