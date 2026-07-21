# agentic-starter

> **Wiederverwendbares Starter-Gerüst**, um ein agentisches System von Grund auf aufzubauen.
> Klone es für jedes neue System, tausche die Agenten aus, lass es wachsen.
>
> Dieses Repo macht das Rezept des `Agent-Matrix`-Systems (AI Orchestra) **minimal und
> domänenunabhängig**. Dieselben Muster — Hub-and-Spoke-Orchestrator,
> deterministische BREMSEN, HITL, MOAT-Sicherheit, SSE — aber in 20 Dateien, lauffähig.

## In 30 Sekunden starten

```bash
npm install
npm run demo      # KEIN API-Schlüssel ERFORDERLICH — zeigt im Mock-Modus den kompletten Ablauf
```

Für ein echtes LLM: `cp .env.example .env` → `ANTHROPIC_API_KEY` hinzufügen → erneut `npm run demo`.
Als Server: `npm start` → `POST /api/run` (siehe unten).

---

## Der Kern: Das System wächst aus EINEM EINZIGEN AGENTEN

Denk bei einem agentischen System nicht an einen "Schwarm aus 16 Agenten". **Es beginnt mit einem einzigen Agenten und wächst Schicht für Schicht.** Dieses Repo zeigt genau dieses Wachstum. Wiederhole jede Stufe in deinem eigenen System in derselben Reihenfolge:

### Stufe 1 — Ein einzelner Agent, Ende-zu-Ende (`researcher`)
Das kleinste lauffähige Ding: Eine Aufgabe entgegennehmen, einen Agenten ausführen, ein Ergebnis zurückgeben. Du brauchst noch nicht einmal einen Orchestrator. **Bring zuerst das zum Laufen.** `agents/researcher.js`.

> 🎓 Fang nicht mit dem Glamour an (16 Agenten, 3D-UI). Lass zuerst einen einzigen Ablauf Ende-zu-Ende laufen.

### Stufe 2 — Ein zweiter Agent + ein Gehirn (`orchestrator`)
Sobald es zwei Agenten gibt, stellt sich die Frage "Wer ist als Nächstes dran?". Leg die Antwort **nicht an die Kanten, sondern in einen einzigen Orchestrator** (Hub-and-Spoke). `agents/orchestrator.js` + `workflow/graph.js`.

### Stufe 3 — Qualitätsschleife (`writer` ⇄ `critic`)
Trenne den Produzenten vom Prüfer. Der Writer schreibt, der Critic genehmigt/lehnt ab, die Schleife dreht sich. Beende Endlosschleifen **mit Zähler + hartem Limit** (`revisionCount >= 5`). `agents/writer.js`, `agents/critic.js`.

### Stufe 4 — Der Mensch am kritischen Punkt (`human_approval`)
Keine nach außen gerichtete Aktion geschieht ohne menschliche Genehmigung. Der Graph **stoppt vor** `human_approval` (`interruptBefore`), der Mensch entscheidet, dann geht es weiter. `workflow/runner.js`.

### Stufe 5 — Sicherheit (MOAT) und Sichtbarkeit
Nicht zum Schluss — ein Teil davon muss von Anfang an drin sein: Eingabe-Guardrail, Rate-Limit, Auth, Aktions-Isolation, Live-SSE-Stream, Kosten-Kill-Switch. `security/`, `lib/eventBus.js`, `services/costTracker.js`.

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
   ↓
publisher → ActionQueue → (Worker validiert + führt aus) → END
```

**Routing ist dreischichtig** (`orchestrator.js`): (1) deterministische BREMSEN lösen die meisten Fälle ohne jegliche LLM-Kosten, (2) das LLM nur bei Unklarheit, (3) die Post-LLM-Validierung prüft die Modellausgabe gegen die Geschäftsregeln.

---

## Dateiübersicht

| Datei | Was sie lehrt |
|-------|------------|
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

## Zum Erweitern → `EXTEND.md`

Schritte zum Hinzufügen neuer Agenten, Multi-Tenancy, persistente DB/Checkpointer, RAG, echte Action-Executor und Production-Härtung finden sich dort.

## Das vollständige Rezept

Alle "Warums" hinter diesem Gerüst (die 17 Gründerlektionen) stehen in deinem
Dokument `SISTEM-INSA-REHBERI.md`. Dieses Repo ist die **lauffähige, klonbare
Zusammenfassung** jenes Dokuments.
