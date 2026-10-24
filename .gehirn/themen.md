# Themen

Offene Stränge, die sich über mehrere Sitzungen ziehen. Zu Sitzungsbeginn gelangt nur der
Abschnitt **Aktive Themen** in den Kontext, begrenzt auf die ersten 12 Zeilen — also höchstens
sechs Themen gleichzeitig. Sind es mehr, schließe oder bündle das am wenigsten dringende.

Wird ein Thema zu einer Entscheidung, wandert es nach `DECISIONS.md` und wird hier geschlossen.

## Aktive Themen

### Thema: Domäne `immobilien` — Schritt 4, Instrument geprüft, Zahl fehlt
**Status:** 🟡 Schritte 1–3 erledigt. **Schritt 4:** der Schicht-B-Harness steht, und seit 2026-09-07 ist auch das **Messinstrument selbst geprüft** — die Schleife liegt als `evals/runners/messung.js` mit injizierten Abhängigkeiten vor, `tests/schichtB.test.js` fährt sie mit einem Skript-Writer über alle Wege (9 Tests, ohne Schlüssel, ohne Kosten). Zwei Sabotageproben bestätigt: T8 nach der Schleife überschreiben und die Ausgabengrenze aushebeln werden beide von genau den richtigen Tests gefangen. **ADR-0030:** T8 misst den ersten Versuch. **Weiterhin blockiert:** kein `ANTHROPIC_API_KEY` — weder als Variable noch über `ant` (nicht installiert); `env.js` liest ohnehin nur `ANTHROPIC_API_KEY` und sendet ihn als `x-api-key`, ein OAuth-Token ginge ohne Codeänderung nicht. Danach: `npm run evals:quality -- --objekte 1`, dann der volle Lauf (~0,20–0,40 USD).

### Thema: Drei Sitzungen Arbeit liegen uncommittet
**Status:** 🔴 Wächst weiter. Guardrail-Schwelle, ADR-0026/0027, Persistenz, die Drift-Bereinigung, die Testinfrastruktur der Domäne, ADR-0028 und jetzt die Harness-Parametrisierung (ADR-0029) stehen im Arbeitsverzeichnis, nicht in der Historie. Die CI (P2 grün) hat von alledem nichts gesehen — ihr grüner Lauf gehört zu `17ecdfe`. Commit und Push sind eine ausdrückliche Entscheidung der Nutzerin oder des Nutzers, deshalb wartet es hier.

### Thema: Beraterkonsole (UI `immobilien`) — Plan steht, E8 offen
**Status:** 🟡 `docs/ui-freigabe-konsole.md` (2026-09-13), E1–E7 entschieden. **Offen:** E8 Schlüsselweg im Browser (blockiert Schritt 3) · Verhalten beim Revisionslimit durch Ausführen klären · Statusquelle je Objekt · ADR für Bearbeiten/Freigabe mit Hinweis (ändert die Aussage in `PRODUCT.md`/`EVALS.md`). Kein Code geschrieben.

### Thema: MCP-Adapter — Server in Phase 4
**Status:** 🟡 ADR-0022: `run_workflow`, `get_status`, `list_queue` — **kein** `approve`. `@modelcontextprotocol/sdk` vorab freigegeben. Client wandert nach Phase 6 (ADR-0024).

## Abgeschlossene Themen

### Thema: Persistenz und `tenantId` (T11)
**Abgeschlossen:** 2026-09-06. Eigene Datei-Schicht statt Paket (**ADR-0027**): das
SQLite-Paket hätte `better-sqlite3` und damit eine native Übersetzung nachgezogen — T7 wäre
von einer Build-Toolchain abhängig geworden. Zwei neue Kerndateien (16 → 18 von 20). Der
Checkpointer wird **geerbt, nicht nachgebaut**. Der teure Befund: `serde.loadsTyped` ist
asynchron, das Abspielen im Konstruktor reichte ein Promise weiter und der Speicher blieb
still leer — sichtbar erst im Lauf, nie beim Lesen. Prova: zwei echte Kindprozesse mit
PID-Vergleich, inklusive Ablehnung über die Prozessgrenze. Drei Grenzen in `ARCHITECTURE.md`
§4 geschlossen, zwei neue (unbegrenztes Log, keine Sperre zwischen Prozessen) eröffnet.

### Thema: Phase 3 — Messen
**Abgeschlossen:** 2026-09-06. T3–T6 grün (**81 Tests, 95,58 %, kein `todo`**), Umzug in die
Zielstruktur, Harness läuft (20/20 vertragstreu, zwei identische Durchgänge). Die letzte
offene Zeile **P2** ist mit dem ersten CI-Lauf grün geworden — von der Nutzerin oder dem
Nutzer auf der Actions-Seite geprüft, für den Stand von `17ecdfe`. Der Judge-Teil der
Schicht B gehört seit ADR-0024 in Phase 4.

### Thema: Guardrail-Schwelle und Idempotenz der ActionQueue
**Abgeschlossen:** 2026-09-06. Zwei alte Posten in einem Zug, jeder mit eigener Prova.
Blockierschwelle 8 → 3 (sanitisieren 3 → 2); der `todo`-Test in `tests/guardrail.test.js`
ist grün geworden statt gelöscht, Metrik 3.5 steht auf einem Nenner von 3 statt 1. Zwei
Nebenbefunde beim Bauen: `sanitize()` deckte das neue Band nicht ab (das Log hätte
„sanitisiert" gemeldet, ohne etwas zu ändern) und der Harness trug die Schwelle als zweite
Kopie im Code. Dazu **ADR-0026**: Idempotenzschlüssel und Dedup in der ActionQueue, vor dem
echten Executor statt danach — `delivery` zweimal ergibt 3 Einträge statt 6. Zum Schluss die
Drift-Bereinigung: `PRODUCT.md` §8 stand auf Phase 2, die Abdeckung in vier Dateien in zwei
Fassungen. Alles auf eine gemessene Zahl mit Datum.

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
