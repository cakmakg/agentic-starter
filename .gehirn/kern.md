# Projektgedächtnis: Kern

Diese Datei ist der dauerhafte Anker für jeden Agenten, der im Repo `agentic-starter`
arbeitet. Sie bleibt kurz: die dauerhafte Wahrheit steht in den Repo-Dokumenten,
hier steht nur die Orientierung.

## Was dieses Repo ist

**agentic-starter** — ein Startgerüst, das produktionsreife Muster für den Bau
menschlich genehmigter Multi-Agenten-Systeme zeigt, domänenunabhängig.

Kein SaaS, sondern ein **Satz technischer Muster**. Zugleich ein öffentlicher
Arbeitsnachweis: nicht nur die Arbeit zählt als Beweis, sondern **wie sie gemessen wurde**.

Produktdefinition, Umfangsgrenzen und Nicht-Ziele: `PRODUCT.md`.

> Die Autoritätskette und das Gedächtnisprotokoll stehen in `CLAUDE.md` — dort und nur dort.
> Claude Code lädt jene Datei ohnehin bei jeder Sitzung; eine zweite Kopie hier würde
> irgendwann auseinanderdriften. Diese Datei trägt nur, was sonst nirgends steht.

## Was niemals vergessen werden darf

- **Dieses Projekt existiert, um den Fehler „es läuft doch, aber niemand weiß wie gemessen"
  zu lösen — und ist selbst hineingelaufen.** Die Prüfung in Phase 0 fand 13 Befunde, drei
  davon blockierend: der Demo-Durchlauf stürzt ab, eine Ablehnung stoppt die Veröffentlichung
  nicht, die Abhängigkeitsinstallation ist beschädigt. Die Baseline steht in `PRODUCT.md` §6.1
  und ist **absichtlich rot**. Der Übergang von Rot zu Grün ist selbst der Beweis; er wird
  nicht versteckt.

- **Der Mock-Modus ist die Grundlage von allem.** Ohne `ANTHROPIC_API_KEY` läuft der komplette
  Ablauf Ende zu Ende. Tests und die Evaluationen der **Schicht A** bauen darauf:
  deterministisch, kostenlos, in CI ausführbar. Im Gegenzug messen sie **nicht** die Qualität
  der LLM-Ausgabe, sondern die Korrektheit von Routing und Richtlinien. Die Qualität misst
  seit ADR-0019 die **Schicht B** gegen ein echtes Modell, als Ausgabevertrag statt als
  Urteil — diese Unterscheidung gehört in jede Evaluationsdiskussion (`EVALS.md` §1–2).

- **Das Repo dient zwei Zwecken — und die Reihenfolge hat sich einmal geändert.** ADR-0020
  setzte: erst der Arbeitsnachweis, dann der Produktkern. Seit **ADR-0024** läuft das
  Produkt zuerst: **Ausführungsreihenfolge `2 → 3 → 5 → 4 → 6`**, Phase 5 vor Phase 4.
  Grund: zwei Behauptungen dieses Repos sind ohne Kunden nicht belegbar — das Prüfkriterium
  aus ADR-0018 braucht eine echte Domäne (`immobilien`), Achse 04 einen echten
  Geschäftskontext. **Die Phasennummern bleiben** (215 Verweise in 15 Dateien), und
  **Trace, Tests und Schicht A werden nicht verschoben** — die Messdisziplin bleibt vor
  dem Produkt.

- **Dateien zu haben ist kein Beweis.** Eine Aufgabe ist fertig, wenn ihr Prüfbefehl
  durchläuft. Das ist die zentrale Lehre des Projekts und steht als Regel in
  `.gehirn/regeln.md`.

<!-- Neue Einträge kommen mit der Zeit dazu. Nur dauerhafte Wahrheiten, nichts Flüchtiges. -->
