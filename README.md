# agentic-starter

> **Wiederverwendbares Starter-Gerüst**, um ein agentisches System von Grund auf aufzubauen.
> Klone es für jedes neue System, tausche die Agenten aus, lass es wachsen.
>
> Dieselben Muster — Hub-and-Spoke-Orchestrator, deterministische BREMSEN, HITL,
> MOAT-Sicherheit, SSE — minimal, domänenunabhängig und Schicht für Schicht erklärt.

> ⚠️ **Bewusste Wortwahl: „production-patterned", nicht „production-ready".**
> Die Muster sind produktionsreif; dieses Repo ist es nicht. Der Artefakt-Speicher ist eine
> `Map` im Arbeitsspeicher, der Checkpointer ist `MemorySaver`, die Action-Executor sind
> simuliert, und es gibt genau einen Tenant. Das sind bewusste Nicht-Ziele für v1 —
> siehe [`PRODUCT.md`](PRODUCT.md) §5.2.

---

## Status: von Rot nach Grün — dokumentiert

Dieses Projekt existiert, um den Fehler „es läuft doch" zu lösen — und ist selbst
hineingelaufen. Eine Prüfung (Phase 0) fand 13 Befunde, drei davon blockierend. Sie wurden
**nicht versteckt, sondern gemessen** — und in Phase 2 behoben. Die Baseline-Spalte bleibt
stehen: der dokumentierte Übergang ist der eigentliche Nachweis, nicht der Endzustand.

| Kriterium | Baseline (Phase 0) | Heute |
|---|---|---|
| `npm run demo` läuft durch | ❌ `GraphRecursionError` | ✅ Exit 0, Endstatus `PUBLISHED` |
| Ablehnung stoppt die Veröffentlichung | ❌ wurde trotzdem veröffentlicht | ✅ Artefakt bleibt `AWAITING_APPROVAL`, Queue leer |
| Ungültiger API-Key wird abgelehnt | ❌ wurde bereinigt und akzeptiert | ✅ 401, laufzeitkonstanter Vergleich |
| `npm test` | ❌ keine Testinfrastruktur | ✅ 68 grün + 1 todo (bekannter Defekt), 96,86 % Zeilenabdeckung in `src/` |
| `npm run evals` erzeugt Baseline | ❌ kein Harness | ✅ 20 Aufgaben, Approval-Enforcement 100 %, Unauthorized-Action 0 % |

Vollständige Baseline und Messmethode: [`PRODUCT.md`](PRODUCT.md) §6.1.
Den aktuellen Zustand jederzeit selbst prüfen: Skill **`projekt-doktor`** — 14 Checks,
vier davon direkt an ein Phasen-Gate gekoppelt.

> **Dateien zu haben ist kein Beweis. Ein bestandener Prüfbefehl ist einer.**
> Das ist die zentrale Regel dieses Repos.

---

## In 30 Sekunden starten

```bash
npm install
npm run demo      # KEIN API-Schlüssel ERFORDERLICH — Mock-Modus zeigt den kompletten Ablauf
```

> **Voraussetzung:** Node ≥ 20 (entwickelt und geprüft auf 24). Der Durchlauf zeigt
> `researcher → writer ⇄ critic → fileSaver`, hält bei `human_approval` an, genehmigt
> im Skript und endet mit `PUBLISHED`. Exit-Code 0.

Für ein echtes LLM: `cp .env.example .env` → `ANTHROPIC_API_KEY` hinzufügen → erneut `npm run demo`.
Als Server: `npm start` → `POST /api/run` (siehe unten).

---

## Der Kern: Das System wächst aus EINEM EINZIGEN AGENTEN

Denk bei einem agentischen System nicht an einen „Schwarm aus 16 Agenten". **Es beginnt mit
einem einzigen Agenten und wächst Schicht für Schicht.** Dieses Repo zeigt genau dieses
Wachstum. Wiederhole jede Stufe in deinem eigenen System in derselben Reihenfolge.

### Stufe 1 — Ein einzelner Agent, Ende-zu-Ende (`researcher`)

Das kleinste lauffähige Ding: eine Aufgabe entgegennehmen, einen Agenten ausführen, ein
Ergebnis zurückgeben. Du brauchst noch nicht einmal einen Orchestrator. **Bring zuerst das
zum Laufen.** → `src/domains/report/agents/researcher.js`

> 🎓 Fang nicht mit dem Glamour an (16 Agenten, 3D-UI). Lass zuerst einen einzigen Ablauf
> Ende-zu-Ende laufen.

### Stufe 2 — Ein zweiter Agent + ein Gehirn (`orchestrator`)

Sobald es zwei Agenten gibt, stellt sich die Frage „Wer ist als Nächstes dran?". Leg die
Antwort **nicht an die Kanten, sondern in einen einzigen Orchestrator** (Hub-and-Spoke).
→ `src/domains/report/domain.js` (Bremsen) + `src/kernel/graph/build.js` (Topologie)

### Stufe 3 — Qualitätsschleife (`writer` ⇄ `critic`)

Trenne den Produzenten vom Prüfer. Der Writer schreibt, der Critic genehmigt oder lehnt ab,
die Schleife dreht sich. Beende Endlosschleifen **mit Zähler + hartem Limit**.
→ `src/domains/report/agents/writer.js`, `src/domains/report/agents/critic.js`

> ✅ **Behoben in Phase 2 (T2.2).** Genau hier lag einer der blockierenden Fehler: der
> Orchestrator unterschied nicht zwischen „noch nicht geprüft" und „abgelehnt", also führte
> kein Weg zurück zum `writer`. Die Bremse ist jetzt geteilt — `isApproved == null` geht zum
> `critic`, `isApproved === false` zurück zum `writer`. Damit wächst `revisionCount` und das
> harte Limit `>= 5` greift wirklich.
### Stufe 4 — Der Mensch am kritischen Punkt (`human_approval`)

Keine nach außen gerichtete Aktion soll ohne menschliche Genehmigung geschehen. Der Graph
**stoppt vor** `human_approval` (`interruptBefore`), der Mensch entscheidet, dann geht es weiter.
→ `src/kernel/graph/runner.js`

> ✅ **Behoben in Phase 2 (T2.3).** Die Kante `human_approval → publisher` ist jetzt bedingt
> und **fail-closed**: nur `humanApproval === true` führt zum `publisher`, `false` und `null`
> führen nach END. Nach einer Ablehnung bleibt das Artefakt `AWAITING_APPROVAL` und die
> Queue ist leer — verifiziert durch Ausführen. **Die zentrale Sicherheitszusage dieses
> Repos ist damit im Code eingelöst.**
### Stufe 5 — Sicherheit (MOAT) und Sichtbarkeit

Nicht zum Schluss — ein Teil davon muss von Anfang an drin sein: Eingabe-Guardrail, Rate-Limit,
Auth, Aktions-Isolation, Live-SSE-Stream, Kosten-Kill-Switch.
→ `src/kernel/security/`, `src/kernel/observability/eventBus.js`, `src/kernel/observability/costTracker.js`

---

## Architektur (auf einen Blick)

```
POST /api/run
   │
START → guardrail ─(Bedrohung)→ END
   │ (sauber)
orchestrator ⇄ { researcher, writer, critic, fileSaver }     ← hub-and-spoke
   │  (BREMSEN: deterministisches Routing, LLM als letztes Mittel)
   │
   ⛔ interruptBefore: human_approval   ← Graph stoppt HIER (HITL)
   │  POST /api/approve
   ├─ approved !== true ──────────────────────────────────→ END   (fail-closed)
   ↓
publisher → ActionQueue → (Worker validiert + führt aus) → END
```

**Routing ist dreischichtig** (`orchestrator.js`): (1) deterministische BREMSEN lösen die
meisten Fälle ohne jegliche LLM-Kosten, (2) das LLM nur bei Unklarheit, (3) die
Post-LLM-Validierung prüft die Modellausgabe gegen die Geschäftsregeln.

Als Diagramme (Mermaid): [`ARCHITECTURE.md`](ARCHITECTURE.md) — Kontext, die drei Ringe,
Graph-Topologie, MCP-Sequenz · [`docs/workflow.md`](docs/workflow.md) — HITL-Sequenz ·
[`docs/security-model.md`](docs/security-model.md) — die zwei Tore der Aktions-Isolation.

---

## Dateiübersicht

### Quellcode (`src/`)

| Datei | Was sie lehrt |
|---|---|
| `state/graphState.js` | State + **Reducer-Auswahl** (Letzter-Wert vs. Aggregator/Schutzschalter) |
| `agents/guardrail.js` | MOAT L1 — Eingabeschutz **ohne LLM** + Budget-Kill-Switch |
| `agents/orchestrator.js` | **Hub** — BREMSEN + LLM-Routing + Post-Validierung |
| `agents/researcher.js` | Agent #1 — Einzelverantwortung |
| `agents/writer.js` + `critic.js` | Revisionsschleife + Zähler-Schutzschalter |
| `agents/fileSaver.js` | Persistenz + HITL-Auslöser (`fileSaved`) |
| `agents/publisher.js` | **Aktions-Isolation** — der Agent ruft keine API auf, sondern schreibt in die Queue |
| `workflow/graph.js` | LangGraph-Topologie + bedingte Kanten + `interruptBefore` |
| `workflow/runner.js` | Stream + **HITL Pause/Resume** (gleiche `thread_id`) |
| `security/auth.js` | `x-api-key`, fail-closed |
| `security/rateLimiter.js` | Endpoint-gestaffeltes Rate-Limit |
| `security/actionQueue.js` | MOAT L4 — Whitelist + Payload-Validierung + Worker |
| `lib/eventBus.js` | SSE + **Event-Buffering** (Lösung für Race-Condition) |
| `services/costTracker.js` | token→USD + **automatischer Budget-Kill-Switch** |
| `services/llm.js` | Einzelner LLM-Adapter + **Mock-Modus** |
| `config/env.js` | Zentrales Einlesen der Umgebung |
| `index.js` · `demo.js` | HTTP-Server · Ende-zu-Ende-Demo ohne HTTP |

### Projektgerüst

| Pfad | Zweck |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Umfang, Nicht-Ziele, **messbare** Erfolgskriterien, Baseline |
| [`EXTEND.md`](EXTEND.md) | Ausbauanleitung: neue Agenten, DB, Multi-Tenancy, RAG |
| `CLAUDE.md` | Router für Coding-Agenten: Ladereihenfolge, Autoritätskette, Gedächtnisprotokoll |
| `.gehirn/` | Projektgedächtnis über Sitzungen hinweg (Kern, Regeln, offene Themen) |
| `.claude/hooks/` | `SessionStart`-Hook, der das Gedächtnis in den Kontext injiziert |
| `.claude/skills/projekt-doktor/` | Gesundheitscheck: 14 Prüfungen, vier davon Phasen-Gates |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DECISIONS.md`](DECISIONS.md) | Trade-offs und bekannte Grenzen · 25 festgehaltene Entscheidungen |
| [`EVALS.md`](EVALS.md) | Evaluationsrahmen: zwei Schichten, Metriken mit Zähler und Nenner, Baseline |
| `docs/` | Ablauf, Sicherheitsmodell, Entwicklungsprozess |
| `tests/` | 11 Dateien, `node:test`, keine zusätzliche Abhängigkeit |
| `evals/` | ⏳ Phase 3 — bis dahin nur `traces/` je Lauf |

---

## Wie hier gemessen wird

Die zentrale Behauptung dieses Repos ist nicht „es läuft", sondern **wie das geprüft wird**.
Die Evaluation hat zwei Schichten, die Verschiedenes messen und nicht vermischt werden dürfen:

| Schicht | Frage | Modell | Wann |
|---|---|---|---|
| **A · Richtlinien** | Hält sich das System an seine eigenen Regeln? | Mock, deterministisch | jeder Push, kostenlos |
| **B · Ausgabevertrag** | Erfüllt die Ausgabe den Vertrag, den sie schuldet? | echtes Modell | eigener Lauf |

Schicht B fragt bewusst **nicht** „ist der Bericht gut?" — diese Frage trägt keine Metrik, weil
zwei Menschen sie verschieden beantworten. Gefragt wird, ob die Ausgabe einen vorab
festgelegten, überprüfbaren **Vertrag** erfüllt. Und der Judge wird selbst gemessen: unter 80 %
Übereinstimmung mit menschlichen Etiketten wird sein Wert nicht berichtet.
Definitionen mit Zähler und Nenner: [`EVALS.md`](EVALS.md) §3.

---

## Wohin das geht

**Ausführungsreihenfolge: `2 → 3 → 5 → 4 → 6`.** Die Phasennummern bleiben, das Produkt
läuft vor der Veröffentlichung (ADR-0024) — zwei Behauptungen dieses Repos sind ohne echte
Domäne und echten Kunden nicht belegbar. Die Tabelle steht in Ausführungsreihenfolge.

| Phase | Inhalt | Stand |
|---|---|---|
| 0 · Discovery | Ist-Zustand messen | ✅ |
| 1 · Vertrag | Produkt- und Architekturvertrag, 25 ADRs | ✅ |
| 2 · Stabilisieren | Goldener Pfad + minimaler Trace · Zeit-Baseline des manuellen Prozesses | 🟢 Defekte behoben, Trace grün; Kundenspur offen |
| 3 · Messen | Tests, Evaluations-Baseline (Schicht A), minimales CI, Umzug in die Zielstruktur | ✅ T3–T6 grün, Umzug erfolgt |
| 5 · Produkt | Erste echte Domäne, Persistenz, echter Executor, Genehmigungsbildschirm | ⏳ |
| 4 · Veröffentlichen | Schicht B, CI, Lizenz, Case Study, MCP-Server | ⏳ |
| 6 · Skalieren | Mehrmandantenfähigkeit, zweite Domäne, Kontextstrategie | ⏳ nur bei einem zweiten Kunden |

**Zielstruktur** — festgelegt, Umzug in Phase 3: `kernel/` trägt Mechanik, `domains/` trägt
Bedeutung, `adapters/` den Kontakt zur Außenwelt. Prüfkriterium für die Behauptung
„domänenunabhängig": eine zweite Domäne darf **null Zeilen** in Kerndateien ändern.
Baum und Begründung: [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.

**MCP** folgt in Phase 4 als zweiter Adapter über demselben Kern — Werkzeuge `run_workflow`,
`get_status`, `list_queue`. **`approve` wird bewusst nicht angeboten:** sonst könnte derselbe
Agent, der einen Lauf startet, seine eigene Aktion genehmigen. Die Freigabe bleibt auf einem
Kanal, den kein Agent bedient (§7 dort).

---

## HTTP-Nutzung

```bash
# 1) Workflow starten
curl -s -X POST localhost:3000/api/run \
  -H "x-api-key: dev-local-key" -H "content-type: application/json" \
  -d '{"task":"Kurzer Bericht zum Thema X"}'
# → {"threadId":"..."}

# 2) Live verfolgen (separates Terminal)
curl -N localhost:3000/api/events/<threadId>

# 3) Genehmigen (wenn der Graph bei human_approval stoppt)
curl -s -X POST localhost:3000/api/approve \
  -H "x-api-key: dev-local-key" -H "content-type: application/json" \
  -d '{"threadId":"<threadId>","approved":true}'
```

---

## Weiterlesen

- **Ausbauen** → [`EXTEND.md`](EXTEND.md): neue Agenten, persistente DB, Multi-Tenancy, RAG,
  echte Action-Executor, Production-Härtung.
- **Umfang und Kriterien** → [`PRODUCT.md`](PRODUCT.md): was drin ist, was bewusst draußen
  bleibt, und woran Erfolg gemessen wird.
- **Architektur und Trade-offs** → [`ARCHITECTURE.md`](ARCHITECTURE.md), Begründung jeder
  Entscheidung → [`DECISIONS.md`](DECISIONS.md), Messung und Baseline →
  [`EVALS.md`](EVALS.md), Ablauf/Sicherheitsmodell/Arbeitsweise → [`docs/`](docs/).
