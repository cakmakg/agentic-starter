# PRODUCT — agentic-starter

> Dieses Dokument legt fest, was das Produkt ist, für wen es gedacht ist und was als
> Erfolg zählt. Was außerhalb des Umfangs liegt, ist genauso bindend wie das, was drin ist.

**Stand:** Entwurf · Phase 1 (Produkt- und Architekturvertrag)
**Zuletzt aktualisiert:** 2026-09-02

---

## 1. Definition in einem Satz

**agentic-starter** ist ein Startgerüst, das produktionsreife Muster für den Bau menschlich
genehmigter Multi-Agenten-Systeme zeigt — domänenunabhängig.

## 2. Positionierung

Kein SaaS-Produkt, sondern ein **Satz technischer Muster plus Starter-Repo**.

> ⚠️ **Bewusste Wortwahl:** Dieses Projekt bezeichnet sich nicht als *production-ready*,
> sondern als **production-patterned**. Der Grund ist in ADR-0009 festgehalten: der
> Artefakt-Speicher ist eine `Map` im Arbeitsspeicher, der Checkpointer ist `MemorySaver`,
> die Action-Executor sind simuliert und das System kennt genau einen Tenant. Das sind
> bewusste Nicht-Ziele für v1 — aber „production-ready" zu sagen fällt bei der ersten
> technischen Prüfung auf einen zurück. Die Muster sind produktionsreif; dieses Repo ist es nicht.

## 3. Zielgruppe

| Wer | Sucht was | Was dieses Repo gibt |
|---|---|---|
| Entwicklerin, die ein eigenes agentisches System baut | Ein Fundament, das wachsen kann — statt eines „Schwarms aus 16 Agenten" | Die schichtweise Wachstumsreihenfolge und die Begründung jeder Schicht |
| Team, das einen HITL-Ablauf aufbauen will | Wie ein Genehmigungstor richtig gebaut wird | Das Muster `interruptBefore` + checkpointbasiertes Pausieren und Fortsetzen |
| Sicherheitsbewusstes Team | Den Zugriff der Agenten auf die Außenwelt begrenzen | Aktions-Isolation über eine Queue, Whitelist, Payload-Validierung |
| Team, das Messdisziplin sucht | Mehr als nur „es läuft" | Deterministisches Evaluations-Harness und Baseline-Metriken |

**Nicht die Zielgruppe:** wer einen Allzweck-Chatbot sucht, wer ein fertiges SaaS sucht,
wer eine einmalige Demo sucht.

## 4. Das gelöste Problem

Vier wiederkehrende Fehler beim Bau agentischer Systeme:

1. **Zuerst der Glamour.** Ein Schwarm aus 16 Agenten und eine 3D-UI, aber kein einziger
   durchgehender Ablauf.
2. **Sicherheit kommt zuletzt.** Auth, Rate-Limit und Aktions-Isolation werden zum Schluss
   ergänzt — also nicht in die Architektur eingebaut, sondern obendrauf geklebt.
3. **Keine Evaluation.** Es heißt „läuft", aber wie das gemessen wurde, bleibt unklar.
4. **Keine Muster.** Jedes Projekt fängt bei null an und wiederholt dieselben Fehler.

> Dieses Repo existiert, um Punkt 4 zu lösen. Es muss die Punkte 1–3 aber auch auf sich selbst
> anwenden — sonst wird es zum Beispiel für genau das, was es kritisiert. Wo wir diesen
> Ehrlichkeitstest in Phase 1 nicht bestanden haben, steht offen in der Baseline unter §6.1.

## 5. Umfang (v1)

### 5.1 Enthalten

- **Ein einziger lauffähiger Anwendungsfall:** die Erstellung eines kurzen Berichts
  (`researcher → writer ⇄ critic → fileSaver → human_approval → publisher`)
- Hub-and-Spoke-Orchestrierung, dreischichtiges Routing mit deterministischem Vorrang
- HITL: der Graph hält vor `human_approval` an und läuft nach der menschlichen Entscheidung weiter
- MOAT-Sicherheitsschichten: Eingabe-Guardrail, Rate-Limit, Auth, Aktions-Isolation
- Budget-Kill-Switch (Token → USD)
- Live-Stream (SSE) + Event-Buffering
- Mock-LLM-Modus — Ende-zu-Ende-Betrieb ohne API-Schlüssel
- Deterministisches Evaluations-Harness und Baseline-Bericht
- MCP-Server als zweiter Adapter über demselben Kern (Phase 4, ADR-0022) — ohne
  Genehmigungswerkzeug
- Dokumentensatz: diese Datei, `ARCHITECTURE.md`, `EVALS.md`, `DECISIONS.md`, `docs/`

### 5.2 Nicht enthalten (Nicht-Ziele für v1)

| Nicht-Ziel | Warum | Wann |
|---|---|---|
| Demos mit 16 Agenten | Bringt keinen Wert, verkauft nur Komplexität | Nie |
| Echte Action-Executor (Telegram, E-Mail, Webhook) | Erst Mock-Modus; echte Anbindung ist domänenspezifisch | Phase 5 |
| Multi-Tenancy | Architektonische Achse; `tenantId` steht ab Phase 5 mit einem festen Wert im Schema (ADR-0025), die Mandantentrennung selbst kommt später | Phase 6 |
| RAG / Vektorgedächtnis | Eine eigene Kompetenzachse | Phase 6 |
| Persistenter Checkpointer (MongoDB) | `MemorySaver` genügt für v1; die Grenze ist dokumentiert | Phase 5 |
| Observability-Panel | Zuerst die Trace-Infrastruktur | Phase 6 |
| Konnektoren zu fremden Systemen | Der Portfolio-Datensatz kommt von Hand oder über einen einzigen Export | Phase 6 |
| MCP-Client (Agenten nutzen externe MCP-Server) | Bringt externe Nichtdeterminiertheit genau in die Messphase; erst Server, dann Client (ADR-0022) | Phase 6 |
| Allzweck-Chatbot | Widerspricht der Produktdefinition | Nie |
| Domänenspezifische Optimierung (im Kern) | Widerlegt die Behauptung „domänenunabhängig" | Nie |

> **Die Spalte „Wann" nennt Phasennummern, keine Reihenfolge.** Seit ADR-0024 wird Phase 5
> vor Phase 4 ausgeführt, und Phase 6 (Skalieren) ist neu: sie beginnt nur, wenn ein zweiter
> Kunde oder eine zweite Vertikale sie auslöst. Was dort steht, ist nicht terminiert,
> sondern bedingt.

## 6. Erfolgskriterien

Jedes Kriterium muss **ausführbar** sein. „Die Datei existiert" ist kein Kriterium.

### 6.1 Technisch

| # | Kriterium | Wie gemessen | Baseline (2026-09-02) | Stand |
|---|---|---|---|---|
| T1 | `npm run demo` läuft im Mock-Modus durch | Exit-Code `0`, Endstatus des Artefakts `PUBLISHED` | ❌ **FEHLGESCHLAGEN** — `GraphRecursionError` | ✅ **grün** (T2.2) — Exit 0, Endstatus `PUBLISHED` |
| T2 | Eine Ablehnung stoppt die Veröffentlichung | Nach `approved:false` ist das Artefakt **nicht** `PUBLISHED` und die Queue leer | ❌ **FEHLGESCHLAGEN** — wird veröffentlicht | ✅ **grün** (T2.3) — Artefakt bleibt `AWAITING_APPROVAL`, Queue leer |
| T3 | `npm test` grün, Zeilenabdeckung in `src/` ≥ 80 % | Ausgabe des Test-Runners | ❌ keine Testinfrastruktur | ✅ **grün** — **129 Tests**, 0 Fehler, **0 todo**; **92,10 %** Zeilenabdeckung (gemessen 2026-09-07; siehe Hinweis unten) |
| T4 | `npm run evals` erzeugt einen Baseline-Bericht | Datierte Berichtsdatei | ❌ kein Harness | ✅ **grün** (T3.3) — `evals/reports/2026-09-03-schicht-a.json`, 20 Aufgaben, zwei Durchgänge identisch. **Seit 2026-09-07 (ADR-0029) je Domäne ein Bericht:** `report` 20 Aufgaben, `immobilien` 23 — der Bericht von `report` ist dabei zeichengleich geblieben |
| T5 | Approval-Enforcement-Rate = 100 % | Evaluationsmetrik (Definition: `EVALS.md` §3) | ❌ derzeit 0 % | ✅ **grün** — **100 %** (3/3) im ersten Harness-Lauf |
| T6 | Unauthorized-Action-Rate = 0 % | Evaluationsmetrik (Definition: `EVALS.md` §3) | ❌ verletzt | ✅ **grün** — **0 %** (0/3 eingereihte Aktionen ohne Freigabe) |
| T7 | Auf einer frischen Maschine läuft `clone → install → demo` im ersten Anlauf | Manuell oder in CI | ❌ **wegen T1** — die Installation selbst ist grün (Korrektur unten) | ✅ **grün** — frisches Verzeichnis, `npm ci` → `npm run demo` → `PUBLISHED` |
| T8 | Vertragskonformität = 100 % | Evaluationsmetrik Schicht B (Definition: `EVALS.md` §3.8) | ❌ **0 %** (erwartet) — der Writer-Prompt fordert keinen Beleg | 🟡 **Harness steht, Zahl fehlt (2026-09-07)** — `npm run evals:quality` misst die Konformität im **ersten Versuch** (ADR-0030), 10 Objekte × 3 Portale gegen ein echtes Modell. Geprüft bis an die Modellgrenze: Verweigerung im Mock, Trockenlauf, Verdrahtung, Exit-Codes. **Der Messwert selbst ist offen — in dieser Umgebung ist kein `ANTHROPIC_API_KEY` gesetzt** |
| T9 | `sanitizeApiKey` lehnt ungültige Schlüssel ab, statt sie zu bereinigen | Ein Schlüssel mit ungültigen Zeichen ergibt 401 | ❌ **verletzt** — `d!e!v!-!l!o!c!a!l!-!k!e!y` wird akzeptiert | ✅ **grün** (T2.4) — 401 bei ungültigem Format, laufzeitkonstanter Vergleich |
| T10 | Der Kern bleibt domänenfrei | `git diff --stat`: beim Aufnehmen der Domäne geänderte Zeilen unter `src/kernel/`. Ziel **0**. Ein Registry-Eintrag zählt nicht mit, das ist Konfiguration | — keine Baseline, neu mit ADR-0024 | ✅ **grün (2026-09-03)** — zweite Domäne `immobilien` als Geschwisterdatei zu `domains/report/` aufgenommen, **0 Zeilen** unter `src/kernel/` geändert. `git diff --stat` ist dafür (noch) kein Beleg: `src/kernel/` ist selbst nie committet worden; verifiziert stattdessen über die vollständige Liste geänderter Pfade dieser Sitzung (nur `domains/immobilien/**`, `bin/demoImmobilien.js`, `package.json`) |
| T11 | Persistenz: ein Neustart verliert keine wartende Genehmigung | Bei einem Lauf im Zustand `AWAITING_APPROVAL` wird der Prozess neu gestartet; `POST /api/approve` wirkt weiterhin, das Artefakt wird `PUBLISHED` | — keine Baseline, neu mit ADR-0024 | ✅ **grün (2026-09-06)** — `tests/integration/persistence.test.js` startet **zwei echte Kindprozesse** und vergleicht ihre PIDs: der zweite findet das wartende Artefakt vor der Genehmigung und bringt es auf `PUBLISHED`. Eine Ablehnung nach dem Neustart lässt es `AWAITING_APPROVAL` und die Queue leer (ADR-0027) |
| T12 | Ein echter Lauf ist abgeschlossen | Ein aus einem echten Portfolio-Datensatz erzeugtes Inserat wurde von einer Beraterin oder einem Berater genehmigt und ausgeliefert; die Trace-Datei liegt vor | — keine Baseline, neu mit ADR-0024 | ❌ offen — Phase 5 |
| T13 | Der ROI ist gemessen | Bearbeitungszeit von Hand gegen Bearbeitungszeit mit System, über mindestens 10 Inserate | ✅ **Hand-Baseline erhoben (2026-09-03)** — 10 Inserate, Mittelwert 35,3 min, Median 34,5 min, ~23,5 Std./Monat; siehe `docs/kundenerkundung-immobilien.md` §3 | 🟡 Baseline steht, Vergleich mit System offen — Phase 5 |


> **Korrektur (2026-09-02, Phase 2 / T2.1) — durch Ausführen verifiziert.** Die Baseline
> nannte als Ursache für T7 eine „beschädigte Abhängigkeitsinstallation". **Das reproduziert
> nicht.** `npm ci` aus der Lockdatei und `npm install` ohne Lockdatei liefern beide
> Exit-Code 0 und 108 Pakete. T7 bleibt rot, aber **allein wegen T1** — der Demo-Durchlauf
> stirbt am Rekursionslimit, nicht an den Abhängigkeiten.
>
> Damit wird auch eine Drift zwischen zwei Dokumenten sichtbar: `PRODUCT.md` nannte als
> dritten blockierenden Defekt die Installation, `ARCHITECTURE.md` §4 dagegen
> `sanitizeApiKey`. Richtig ist `sanitizeApiKey`, ebenfalls durch Ausführen bestätigt:
> `d!e!v!-!l!o!c!a!l!-!k!e!y` wird zu `dev-local-key` und akzeptiert; ein mit Leerzeichen
> gepolsterter Schlüssel ebenso. Der Defekt hat jetzt ein eigenes Kriterium: **T9**.

> **Die Baseline-Spalte war absichtlich rot und wird nie überschrieben** (ADR-0015). Sie
> ist der Referenzpunkt, gegen den jede spätere Aussage geprüft wird; färbte man sie grün,
> verschwände genau der Nachweis, den dieses Projekt erbringen will. Fortschritt steht in
> der Spalte **Stand**, jeweils mit der Aufgabe, die ihn erzeugt hat.

> **Was die 93,27 % nicht enthalten.** Der Test-Runner instrumentiert nur Dateien, die
> auch geladen werden. `src/adapters/http/server.js` (Express-Server) und die Skripte unter
> `src/bin/` (mit `process.exit`) importiert kein Test — sie tauchen deshalb **gar nicht im
> Nenner auf**, nicht erst durch das `--test-coverage-exclude` im Skript. Die Ausschlüsse
> stehen dort, damit die Lücke im Befehl sichtbar ist statt still zu bleiben; ihre Pfade
> zeigten bis 2026-09-06 noch auf die Namen **vor** dem Umzug in die Zielstruktur und sind
> jetzt nachgezogen. Die Auth-Logik aus dem Server ist über `auth.js` direkt abgedeckt; der
> Ablauf aus `demo.js` über `tests/workflow.test.js`. Ungeprüft bleibt die
> HTTP-Verdrahtung selbst.
>
> **Warum die Zahl mit mehr Tests zweimal gefallen ist.** Erst 95,64 % → 93,27 %: der
> Ablauf-Test der Domäne `immobilien` lädt deren Graphen und zieht Dateien in den **Nenner**,
> die vorher gar nicht gemessen wurden. Dann 93,27 % → 92,10 % (2026-09-07): `tests/schichtB.test.js`
> zieht `evals/` in den Nenner. Beide Male gilt dasselbe: mehr Code unter Beobachtung senkt den
> Durchschnitt, die Abdeckung ist gewachsen.
>
> Die zweite Bewegung lohnt einen genaueren Blick, weil sie sonst wie eine Lücke aussähe:
> `evals/runners/messung.js` steht auf **100 %**. Gefallen ist der Schnitt an
> `evals/metrics/index.js` (42 %) und `evals/domains/immobilien/adapter.js` (76 %) — deren
> unbedeckte Hälfte ist die **Schicht-A-Mechanik**, und die misst nicht `npm test`, sondern
> `npm run evals`. Nicht ungetestet, sondern von einem anderen Befehl getestet.

> **T10–T13 tragen keine Baseline aus Phase 0.** Sie entstanden mit ADR-0024 und messen
> Dinge, die es damals nicht gab; eine leere Baseline-Spalte ist hier ehrlicher als eine
> nachträglich geschätzte. **Eine Ausnahme mit Frist:** die Baseline von T13 muss **in
> Phase 2 erhoben werden, bevor das System steht**. Danach erhoben wäre sie keine Baseline,
> sondern eine Schätzung im Rückblick — und T13 („wir haben beschleunigt") wieder eine
> Behauptung statt einer Messung.

### 6.2 Dokumentation

| # | Kriterium | Stand |
|---|---|---|
| D1 | `PRODUCT.md` — Umfang, Nicht-Ziele, messbare Kriterien | ✅ diese Datei |
| D2 | `ARCHITECTURE.md` — Architekturentscheidungen und Trade-offs | ✅ inkl. bekannter Grenzen |
| D3 | `EVALS.md` — Rahmen, Metrikdefinitionen, Baseline | ✅ Metriken mit Zähler und Nenner |
| D4 | `DECISIONS.md` — mindestens 10 festgehaltene Architekturentscheidungen | ✅ 31 ADRs |
| D5 | `docs/` — Workflow, Sicherheitsmodell, Entwicklungsprozess | ✅ alle drei |
| D6 | `README.md` — im Case-Study-Format | ⏳ Phase 4 |

### 6.3 Öffentlicher Arbeitsnachweis

| # | Kriterium | Stand |
|---|---|---|
| P1 | Repo öffentlich | ⏳ |
| P2 | CI: bei jedem Push demo + test + evals | ✅ **grün (2026-09-06)** — die Workflow-Datei hat gelaufen und ist durchgelaufen (`npm ci` → test → demo → evals, Schicht A, ohne Schlüssel). Geprüft auf der Actions-Seite, nicht von einem Befehl hier; der grüne Lauf gehört zum Stand von `17ecdfe` |
| P3 | LICENSE | ⏳ Phase 4 |
| P4 | Evaluationsbericht veröffentlicht | ⏳ Phase 3 |
| P5 | Case-Study-Artikel | ⏳ Phase 4 |

## 7. Phasenplan

**Die Nummern bleiben, die Ausführungsreihenfolge ist `2 → 3 → 5 → 4 → 6`** (ADR-0024).
Die Tabelle steht in Ausführungsreihenfolge, nicht in Zahlenfolge.

| Phase | Ziel | Ausgangstor |
|---|---|---|
| **0 · Discovery** | Den Ist-Zustand messen | ✅ Abgeschlossen — 13 Befunde, drei blockierend |
| **1 · Vertrag** | Produkt- und Architekturvertrag | ✅ Abgeschlossen — Gerüst + 7 Dokumente, D1–D5 grün |
| **2 · Stabilisieren** | Goldener Pfad + minimaler Trace · Kundenerkundung · Zeit-Baseline des manuellen Prozesses | ✅ **Abgeschlossen** — T1, T2, T7, T9 grün; Trace grün (T2.5 — jeder Lauf hinterlässt `evals/traces/<run_id>.jsonl`); Kundenerkundung und Hand-Baseline schriftlich in `docs/kundenerkundung-immobilien.md` |
| **3 · Messen** | Tests, Evaluations-Baseline (Schicht A), Kontextmessung, minimales CI, Umzug in die Zielstruktur | ✅ **Vollständig abgeschlossen (2026-09-06)** — T3, T4, T5, T6 grün; Umzug erfolgt, dieselben Tests vor und nach ihm mit demselben Ergebnis; **P2 grün**, die CI ist gelaufen |
| **5 · Produkt** | Domäne `immobilien`, Persistenz mit `tenantId`, echter Executor, schlanker Genehmigungsbildschirm | 🟡 **Läuft (Stand 2026-09-07)** — Skelett `portfolioLoader → listingWriter ⇄ contractChecker → listingStore → human_approval → delivery`, **T10 grün** (0 Zeilen unter `src/kernel/`), **T11 grün** (Persistenz mit `tenantId`, ADR-0027). Die Domäne hat seit 2026-09-06 **27 Tests** und zwei Golden-Datensätze (10 Objekte, 12 fehlerhafte Inserate); ihr Ausgabevertrag steht als **ADR-0028**. Seit 2026-09-07 wird sie auch **gemessen**: der Harness ist domänenfrei (ADR-0029), `npm run evals` fährt 23 eigene Aufgaben, 23/23 vertragstreu, beide Durchgänge identisch — und der Bericht von `report` blieb dabei zeichengleich. Offen: **die T8-Zahl** — der Schicht-B-Harness steht seit 2026-09-07 (ADR-0030) und misst den ersten Versuch gegen die zehn Kundendatensätze; ausgeführt wurde er noch nicht, weil hier kein `ANTHROPIC_API_KEY` gesetzt ist. Im Mock ist T8 per Konstruktion erfüllt und damit kein Messwert. Ebenso offen: T12 (echter Lauf mit echtem Datensatz), echter Executor, Genehmigungsbildschirm |
| **4 · Veröffentlichen** | Schicht B vollständig, CI, Lizenz, Fallstudie mit echten Zahlen, MCP-Server | P1–P5 grün; HTTP und MCP verbrauchen denselben Kern |
| **6 · Skalieren** | Mehrmandantenfähigkeit, zweite Domäne, Kontextstrategie, Konnektoren, MCP-Client | **Auslöser: ein zweiter Kunde oder eine zweite Vertikale.** Ohne ihn beginnt diese Phase nicht — spekulative Infrastruktur wird nicht geschrieben |

> Der echte Executor der Phase 5 läuft über den Security Core (ADR-0031); Plan, Kriterien
> und Stand: `docs/kern-integration.md`.

> **Warum das Produkt vor die Veröffentlichung rückt** (ADR-0024): zwei Behauptungen dieses
> Repos lassen sich ohne Kunden nicht belegen — das Prüfkriterium aus ADR-0018 braucht eine
> zweite echte Domäne, Achse 04 braucht einen echten Geschäftskontext, und eine Fallstudie
> vor der Domäne hätte keine echten Zahlen. Trace, Tests und Schicht A rücken deshalb
> **nicht** nach hinten: verschoben wird nur, was ohne Kunden ohnehin nichts Echtes misst.

## 8. Wo dieses Produkt in der Kompetenzkarte steht

Das Projekt ist zugleich ein **öffentlicher Arbeitsnachweis** (ADR-0020). Diese Tabelle sagt
den Stand, nicht die Absicht: „belegt" steht nur dort, wo ein ausführbarer Nachweis existiert.

| Achse | Stand |
|---|---|
| **01 · KI-Anwendungen bauen und ausliefern** | Agentische Systeme ✅ Graph, HITL, Aktions-Isolation, Guardrail (Blockierschwelle seit Phase 5 erreichbar) · Evaluationsgetriebene Entwicklung 🟡 **Schicht A misst beide Domänen und läuft in CI** (20 + 23 Aufgaben, je zwei identische Durchgänge; ADR-0029); Schicht B — der **Ausgabevertrag** hat seit 2026-09-07 einen lauffähigen Harness (ADR-0030), es fehlt der Lauf gegen ein echtes Modell; der **Judge** bleibt Phase 4 · Produktionsbetrieb 🟡 Rate-Limit, Auth, Budget-Schalter, **Trace je Lauf** (T2.5); keine externe Observability-Anbindung · Grounding und ML-Grundlagen ❌ außerhalb des Umfangs |
| **02 · Grundlagen des Software-Engineering** | Trade-offs ✅ 31 ADRs · Tests ✅ **129 Tests, 92,10 % Zeilenabdeckung** (2026-09-07) · Kontext- und Kostenarchitektur 🟡 Kosten je Lauf und Kontextwachstum werden **gemessen** (3.6 · 3.12), eine Kontextstrategie gibt es nicht (`ARCHITECTURE.md` §4) |
| **03 · Coding-Agenten einsetzen** | Aufgabenvorlage ✅ `docs/development-process.md` · Der Nachweis entsteht erst nach der Messschicht, in Phase 4 — vorher misst niemand, wo der Agent bricht |
| **04 · Den Build formen** | Umfang, Nicht-Ziele, messbare Kriterien ✅ dieses Dokument · Echter Geschäftskontext 🟡 die Domäne `immobilien` steht als Skelett (T10 grün, 0 Zeilen im Kern); echt wird sie erst mit T12 — einem Lauf auf echten Portfolio-Daten, von einer Beraterin oder einem Berater genehmigt |

> Die unterscheidendste Achse ist die **evaluationsgetriebene Entwicklung** innerhalb von 01.
> `EVALS.md` ist die zentrale Behauptung dieses Projekts; alles andere stützt sie. Sie steht
> auf 🟡 und nicht auf ✅: die Richtlinien messen sich selbst (Schicht A), die **Qualität**
> der Ausgabe misst noch niemand. Halb eingelöst ist nicht eingelöst — und das gehört so
> gesagt, statt die Zeile grün zu färben, weil ein Harness existiert.

> **Diese Tabelle stand bis 2026-09-06 auf dem Stand von Phase 2** und behauptete „Tests ❌
> noch nicht geschrieben", während §6.1 derselben Datei T3 und T4 längst grün führte. Der
> Widerspruch ist genau der Fehler, gegen den dieses Repo antritt; er wird deshalb hier
> vermerkt statt still korrigiert.
