# Themen

Offene Stränge, die sich über mehrere Sitzungen ziehen. Zu Sitzungsbeginn gelangt nur der
Abschnitt **Aktive Themen** in den Kontext, begrenzt auf die ersten 12 Zeilen — also höchstens
sechs Themen gleichzeitig. Sind es mehr, schließe oder bündle das am wenigsten dringende.

Wird ein Thema zu einer Entscheidung, wandert es nach `DECISIONS.md` und wird hier geschlossen.

## Aktive Themen

### Thema: Domäne `immobilien` — Phase 5, vorgezogen
**Status:** 🟡 Entschieden (ADR-0024), nichts gebaut. `portfolioLoader` ohne LLM · `listingWriter` je Portal · `contractChecker` überwiegend deterministisch. Vertrag: jede Zahl buchstabengleich aus einem Feld, nichts Konkretes ohne Feld. Offen: Bestätigung durch die Kundin oder den Kunden.

### Thema: Persistenz und `tenantId` — Phase 5
**Status:** 🟡 ADR-0025: Checkpointer und Artefakt-Store persistent, `tenantId` mit festem Wert im Schema und **in jeder Abfrage** gefiltert — eine Abfrage ohne Filter ist ein Defekt. Prüfkriterium T11. Mandantentrennung erst Phase 6.

### Thema: Phase 3 — Messen (abgeschlossen bis auf den CI-Lauf)
**Status:** 🟢 T3–T6 grün: 70 Tests (95,19 %), Umzug in die Zielstruktur erfolgt, Harness läuft (20 Aufgaben, 20/20 vertragstreu, zwei Durchgänge identisch). **Offen: der erste CI-Lauf** — `.github/workflows/ci.yml` steht, wurde aber nie ausgeführt; P2 bleibt bis dahin gelb. Der Judge-Teil der Schicht B gehört seit ADR-0024 in Phase 4.

### Thema: MCP-Adapter — Server in Phase 4
**Status:** 🟡 ADR-0022: `run_workflow`, `get_status`, `list_queue` — **kein** `approve`. `@modelcontextprotocol/sdk` vorab freigegeben. Client wandert nach Phase 6 (ADR-0024).

## Abgeschlossene Themen

### Thema: Phase 2 — Stabilisieren, zwei Spuren
**Abgeschlossen:** 2026-09-03. Code-Spur (T2.5) war bereits fertig; die Spur ohne Code —
Kundenerkundung und die **Hand-Baseline von T13** (10 Inserate, Mittelwert 35,3 min, ~23,5
Std./Monat) — jetzt schriftlich in `docs/kundenerkundung-immobilien.md`. T13 selbst bleibt
offen (Phase 5): die geschriebene Zahl ist nur die Hand-Hälfte des Vergleichs, die
System-Hälfte fehlt bis zu einem echten Lauf (T12).

### Thema: Zielstruktur — Umzug in Phase 3
**Abgeschlossen:** 2026-09-03. 19 Dateien umgezogen, drei Ringe stehen: `kernel/` (16 Dateien, Grenze 20) · `domains/report/` · `adapters/http/` + `bin/`. Die Naht wurde an den drei feinen Stellen gezogen — Routing-Verfahren im Kern, Bremsenreihenfolge in der Domäne; Regex-Engine im Kern, Muster in der Domäne; Queue-Mechanik im Kern, Whitelist in der Domäne. Prüfkriterium erfüllt: **dieselben Tests, dasselbe Ergebnis** (69/68/0/1 davor und danach). Zwei bewusste Abweichungen vom gezeichneten Baum: `kernel/config/env.js` (fehlte dort) und `prompts.js` statt `prompts/`.

### Thema: Ausführungsreihenfolge — Produkt vor Veröffentlichung
**Abgeschlossen:** 2026-09-03. Als **ADR-0024** und **ADR-0025** festgehalten. Die Phasennummern bleiben (215 Verweise in 15 Dateien), die Ausführungsreihenfolge ist `2 → 3 → 5 → 4 → 6`. Sechs Bewegungen: Judge-Maschine der Schicht B 3 → 4 · T8 3 → 5 samt Eigentümerwechsel nach `immobilien` · Mehrmandantenfähigkeit 5 → 6 · Kontextstrategie 5 → 6 · minimales CI 4 → 3 · MCP-Client 5 → 6. Neue Kriterien T10–T13. Nachgezogen in neun Dateien.

### Thema: CLAUDE-CODE-BRIEFING.md — neu schreiben oder verwerfen
**Abgeschlossen:** 2026-09-02. Neu geschrieben. Die Datei ist jetzt die türkischsprachige
Darstellung des Projekts für Menschen: Aufbau, Logik, Ziel, Stand. Keine Anweisungsquelle —
bei Widerspruch gelten die Vertragsdokumente. Die Sprachausnahme ist als Nachtrag zu
ADR-0016 vermerkt, der Verweis in `CLAUDE.md` entsprechend ersetzt.

### Thema: Entscheidung über kernel/domain-Trennung
**Abgeschlossen:** 2026-09-02. Als ADR-0018 festgehalten: die Naht wird jetzt als Vertrag
festgelegt, der Umbau von `src/` bleibt bis nach Phase 3 vertagt — in der Zeitfrage gilt
ADR-0014 weiter. Kern trägt Mechanik, Domäne trägt Bedeutung; erste Domäne `report`.
Prüfkriterium: eine zweite Domäne darf null Zeilen in Kerndateien ändern.

### Thema: Phase 1 — Vertragsdokumente
**Abgeschlossen:** 2026-09-02. Sieben Dokumente: PRODUCT, ARCHITECTURE, DECISIONS (17 ADRs),
EVALS, docs/workflow, docs/security-model, docs/development-process. Alle Querverweise und
§-Anker verifiziert. Prüfung 12 des Doktors meldete nach jedem neuen Dokument eine veraltete
`⏳`-Markierung in `CLAUDE.md` — alle bereinigt. `PRODUCT.md` §6.2 D1–D5 auf grün gesetzt.

### Thema: Übersetzung ins Deutsche
**Abgeschlossen:** 2026-09-02. Fünf Entscheidungen: Repo deutsch / Gespräch türkisch ·
`src/` inklusive 219 Kommentarzeilen und 26 Log-Ausgaben · alle Verzeichnis- und Skill-Namen
deutsch (`.brain/` → `.gehirn/`, `proje-doktor` → `projekt-doktor`) · Gedächtnisverlauf
mitübersetzt · Dokumentdateinamen bleiben englisch. Verifiziert: 19 Quelldateien syntaktisch
gültig, keine türkischen Reste, **Verhalten unverändert** (derselbe `GraphRecursionError`,
Baseline erhalten). Offen geblieben: `.env.example` (globale Regel blockiert `.env.*`-Zugriff)
und `CLAUDE-CODE-BRIEFING.md` (beschädigt, T1.9).

### Thema: template/ Gehirn-System anpassen
**Abgeschlossen:** 2026-09-02. Acht Entscheidungen getroffen, 9 Dateien angepasst, eine
(`beyin-doktor` → `projekt-doktor`) im letzten Schritt verbraucht, 28 begründet nicht
übernommen. `template/` wurde aus dem Repo herausbewegt. Die Begründung wird als ADR nach
`DECISIONS.md` geschrieben (T1.3) — Quellversion **v2.1.0**.
