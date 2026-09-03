# EXTEND — Anleitung zum Ausbau des Gerüsts

Dieser Starter ist bewusst minimal: In-Memory-Store, Mock-LLM-Fallback, ein einzelner Tenant.
Die folgenden Schritte verwandeln ihn in ein echtes System. **Mach nicht alles auf einmal** —
folge der Aufbaureihenfolge: erst der Wert, dann der Schutz.

> **Reihenfolge-Hinweis.** Die Schritte 2 bis 7 sind Ausbau *nach vorne*. Der Starter selbst
> steht noch davor: Phase 2 repariert die drei blockierenden Defekte, Phase 3 baut Tests und
> Evaluation. Wer auf diesem Repo aufbaut, sollte das wissen — Stand und Baseline in
> [`PRODUCT.md`](PRODUCT.md) §6.1 und im README.

---

## 1. Einen neuen Agenten hinzufügen (das, was du am häufigsten tust)

> ⚠️ Diese Anleitung beschreibt die **heutige** Ablage. Ab Phase 3 liegen Agenten unter
> `src/domains/<domäne>/agents/` und werden über die Domänen-Spezifikation registriert;
> der Zielbaum steht in `ARCHITECTURE.md` §6 (ADR-0023).

3 Schritte, ohne irgendetwas anderes kaputtzumachen:

1. `src/domains/report/agents/neuerAgent.js` schreiben — Einzelverantwortung, am Ende
   `nextAgent: "orchestrator"` zurückgeben.
2. `src/kernel/graph/build.js`: `.addNode("neuerAgent", neuerAgentNode)` +
   `g.addEdge("neuerAgent", "orchestrator")`.
3. `src/domains/report/domain.js`: eine BREMSE hinzufügen
   (`if (bedingung) return { nextAgent: "neuerAgent" }`) und den Namen zu `VALID_AGENTS`
   **und** dem Enum in `routingSchema` hinzufügen.

> Einen Agenten hinzufügen = „einen Mitarbeiter einstellen". Außer dem Routing des
> Orchestrators ändert sich nichts.

**Vergiss den vierten Schritt nicht:** einen Test. Ein Agent ohne Test ist ein Agent, von dem
niemand weiß, ob er noch funktioniert. Genau diese Lücke hat in Phase 0 drei blockierende
Defekte unentdeckt gelassen.

## 2. In-Memory-Store → persistente DB

`src/domains/report/agents/fileSaver.js` verwendet derzeit eine `Map`. In Production MongoDB/Postgres:

- `store.set(...)` → `Report.findOneAndUpdate({ threadId }, { ... }, { upsert: true })`.
- `getArtifact` → aus der DB lesen (nach einem Reload für den SSE-Fallback zwingend erforderlich).

## 3. MemorySaver → persistenter Checkpointer (WICHTIG)

Das `new MemorySaver()` in `src/kernel/graph/build.js` liegt **im Arbeitsspeicher** — bei einem
Server-Neustart gehen Workflows, die auf HITL warten, verloren. In Production:

- `@langchain/langgraph-checkpoint-mongodb` → `MongoDBSaver`.
- So wird der Graph-State persistent; nach einem Neustart funktioniert die Genehmigung weiterhin.

Das ist zugleich die wichtigste bekannte Grenze des Starters: ohne diesen Schritt ist jede
HITL-Zusage nur so haltbar wie der Prozess.

## 4. Multi-Tenancy (wenn du SaaS anstrebst — von Anfang an mitdenken)

> 🎓 Multi-Tenancy ist kein nachträglicher Gedanke, sondern eine architektonische Achse.
> `tenantId` muss in jeder Abfrage vorhanden sein.

- `Client`-Modell: `slug` (unique), `apiKey` (unique), `plan`, `status`.
- `src/kernel/security/auth.js`: den Key mit `Client.findOne` validieren → `req.tenant` injizieren.
- **Fixiere die Tenant-Identität auf EINEN Typ** — immer `_id` oder immer `slug`, nicht mischen.
  Eine gemischte Identität ist eine der teuersten technischen Schulden überhaupt, weil sie
  jede spätere Abfrage berührt.
- `plans.js`: `allowedAgents[]` = Fähigkeitsmatrix. Das Orchestrator-Routing sollte gegen diese
  Liste prüfen (z. B. kann der Free-Plan nicht auf `writer` zugreifen).

## 5. RAG (Vektor-Gedächtnis)

- `Knowledge`-Sammlung + Embedding-Anbieter.
- `chunkText` (≈500 Wörter, 50 Überlappung) → embedden → tenant-gefilterte Vektorsuche.
- Fallback für die Agenten `researcher`/`analyzer`: wenn der Oberzustand leer ist,
  `searchKnowledge(tenantId, task)`.
- **Achtung:** Die Dimension des Embedding-Modells und die `numDimensions` des Vektor-Index
  müssen GLEICH sein. Eine Abweichung fällt erst zur Laufzeit auf und wirkt wie ein
  Qualitätsproblem, obwohl es ein Konfigurationsfehler ist.

## 6. Echte Action-Executor

`processOne` in `src/kernel/security/actionQueue.js` simuliert derzeit nur. Echte Auslieferung:

- Ein Executor je `actionType`: Telegram (`sendMessage`), E-Mail (SMTP/Resend), Webhook (`fetch`).
- Setze ein **hartes Timeout**, nach 3 Versuchen `FAILED`.
- Anmeldedaten pro Tenant: zuerst `TenantConfig.integrations`, dann globale env.
- Erlaube Agenten **niemals**, direkt eine API aufzurufen — es läuft immer über die Queue.

> Bevor du echte Executor anschließt, muss Phase 2 abgeschlossen sein: solange eine Ablehnung
> die Veröffentlichung nicht stoppt, würde ein echter Executor abgelehnte Inhalte tatsächlich
> nach außen senden.

## 7. Frontend + Live-Monitoring

- Mit `EventSource('/api/events/:threadId')` SSE abhören.
- State-Store (Slice-Architektur): `ui / workflow / ...`.
- Wenn das `workflow_complete`-Event leer ist, Fallback auf `/api/artifact/:threadId`.
- Betriebspanel (später): Live-Monitoring + Kosten + Sicherheitslogs + Workflow-Replay.

## 8. Checkliste zur Production-Härtung

- [ ] Persistenter Checkpointer (nicht `MemorySaver`).
- [ ] `dotenv` + env-Validierung (fehlende kritische env → fail-closed starten).
- [ ] Sicherheits-No-Ops in Production abschalten (Dev-Passthroughs sollen fail-closed sein).
- [ ] Helmet + CORS-Whitelist + Body-Limit.
- [ ] SecurityEvent / Audit-Log (mit TTL).
- [ ] Kosten-Kill-Switch pro Tenant (bereits vorhanden — Budgets an den Plan koppeln).
- [ ] Fire-and-Forget-Seitenschreibvorgänge (`.catch(() => {})`) dürfen den Hauptablauf nicht
      zum Absturz bringen.
- [ ] Liste der technischen Schulden sichtbar halten (in diesem Repo: `DECISIONS.md`, ⏳ Phase 1).

---

### Wachstumsreihenfolge (Zusammenfassung)

**einzelner Agent → Orchestrator → Qualitätsschleife → HITL → Sicherheit → Persistenz →
Multi-Tenant → Betriebspanel.**

Bei jedem Schritt soll das System lauffähig bleiben; geh erst zum nächsten über, wenn du den
vorherigen abgeschlossen hast. „Abgeschlossen" heißt dabei: ein Prüfbefehl läuft durch — nicht,
dass die Datei existiert.
