# EXTEND — Anleitung zum Ausbau des Gerüsts

Dieser Starter ist bewusst minimal: In-Memory-Store, Mock-LLM-Fallback, ein einzelner Tenant.
Die folgenden Schritte verwandeln ihn in ein echtes System. **Mach nicht alles auf einmal** —
folge der Aufbaureihenfolge des Referenzsystems: erst der Wert, dann der Schutz.

---

## 1. Einen neuen Agenten hinzufügen (das, was du am häufigsten tust)

3 Schritte, ohne irgendetwas anderes kaputtzumachen:

1. `agents/yeniAjan.js` schreiben — Einzelverantwortung, am Ende `nextAgent: "orchestrator"` zurückgeben.
2. `workflow/graph.js`: `.addNode("yeniAjan", yeniAjanNode)` + `g.addEdge("yeniAjan","orchestrator")`.
3. `agents/orchestrator.js`: eine BREMSE hinzufügen (`if (kosul) return { nextAgent: "yeniAjan" }`) und zu `VALID_AGENTS` + dem routingSchema-Enum hinzufügen.

> Einen Agenten hinzufügen = "einen Mitarbeiter einstellen". Außer dem Routing des Orchestrators ändert sich nichts.

## 2. In-Memory-Store → persistente DB

`agents/fileSaver.js` verwendet derzeit eine `Map`. In Production MongoDB/Postgres:
- `store.set(...)` → `Report.findOneAndUpdate({threadId}, {...}, {upsert:true})`.
- `getArtifact` → aus der DB lesen (nach einem Reload für den SSE-Fallback zwingend erforderlich).

## 3. MemorySaver → persistenter Checkpointer (WICHTIG)

Das `new MemorySaver()` in `workflow/graph.js` ist **im Arbeitsspeicher** — bei einem
Server-Neustart gehen Workflows, die auf HITL warten, verloren. In Production:
- `@langchain/langgraph-checkpoint-mongodb` → `MongoDBSaver`.
- So wird der Graph-State persistent; nach einem Neustart funktioniert die Genehmigung weiterhin.

## 4. Multi-Tenancy (wenn du SaaS anstrebst — von Anfang an mitdenken)

> 🎓 Multi-Tenancy ist kein nachträglicher Gedanke, sondern eine architektonische Achse. `tenantId` muss in jeder Abfrage vorhanden sein.

- `Client`-Modell: `slug` (unique), `apiKey` (unique), `plan`, `status`.
- `auth.js`: den Key mit `Client.findOne` validieren → `req.tenant` injizieren.
- **Fixiere die Tenant-Identität auf EINEN Typ** (immer `_id` oder immer `slug` — nicht mischen; das war die technische Schuld #1 des Referenzsystems).
- `plans.js`: `allowedAgents[]` = Fähigkeitsmatrix. Das Orchestrator-Routing sollte gegen diese Liste prüfen (z. B. kann der Free-Plan nicht auf `writer` zugreifen).

## 5. RAG (Vektor-Gedächtnis)

- `Knowledge`-Sammlung + Embedding-Anbieter (Geminis kostenlose Stufe ist ein guter Anfang).
- `chunkText` (≈500 Wörter, 50 Überlappung) → embedden → tenant-gefilterte Vektorsuche.
- Fallback für die Agenten `researcher`/`analyzer`: wenn der Oberzustand leer ist, `searchKnowledge(tenantId, task)`.
- **Achtung:** Die Dimension des Embedding-Modells und die `numDimensions` des Vektor-Index müssen GLEICH sein (technische Schuld #3 des Referenzsystems).

## 6. Echte Action-Executor

`processOne` in `security/actionQueue.js` simuliert derzeit nur. Echte Auslieferung:
- Ein Executor für jeden `actionType`: Telegram (`sendMessage`), E-Mail (SMTP/Resend), Webhook (`fetch`).
- Setze ein **hartes Timeout**, nach 3 Versuchen `FAILED`.
- Anmeldedaten pro Tenant: zuerst `TenantConfig.integrations`, dann globale env.
- Erlaube Agenten **niemals**, direkt eine API aufzurufen — es soll immer über die Queue laufen.

## 7. Frontend + Live-Monitoring

- Mit `EventSource('/api/events/:threadId')` SSE abhören.
- State-Store (Zustand-Slice-Architektur): `ui / workflow / ...`.
- Wenn das `workflow_complete`-Event leer ist, Fallback auf `/api/artifact/:threadId`.
- Betriebspanel (später): Live-Monitoring + Kosten + Sicherheitslogs + Workflow-Replay.

## 8. Checkliste zur Production-Härtung

- [ ] Persistenter Checkpointer (nicht MemorySaver).
- [ ] `dotenv` + env-Validierung (fehlende kritische env → fail-closed starten).
- [ ] Sicherheits-No-Ops in Production abschalten (Dev-Passthroughs sollen fail-closed sein).
- [ ] Helmet + CORS-Whitelist + Body-Limit.
- [ ] SecurityEvent / Audit-Log (mit TTL).
- [ ] Kosten-Kill-Switch pro Tenant (bereits vorhanden — Budgets an den Plan koppeln).
- [ ] Fire-and-Forget-Seitenschreibvorgänge (`.catch(()=>{})`) dürfen den Hauptablauf nicht zum Absturz bringen.
- [ ] Halte die Liste der technischen Schulden sichtbar (wie Abschnitt 14 des Referenzdokuments).

---

### Wachstumsreihenfolge (Zusammenfassung)
**einzelner Agent → Orchestrator → Qualitätsschleife → HITL → Sicherheit → Persistenz → Multi-Tenant → Betriebspanel.**
Bei jedem Schritt soll das System lauffähig bleiben; geh erst zum nächsten über, wenn du den vorherigen abgeschlossen hast.
