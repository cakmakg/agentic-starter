# evals — was hier gemessen wird, und was nicht

Die Definitionen stehen in [`EVALS.md`](../EVALS.md). Diese Datei sagt, was der
Harness **tatsächlich** tut, und vor allem: **wo er blind ist.** Ein Rahmen, der
seine Grenzen verschweigt, ist gefährlicher als keiner.

## Ausführen

```bash
npm run evals                  # Schicht A — alle registrierten Domänen
npm run evals -- immobilien    # nur eine, für die Entwicklung
npm run evals:quality          # Schicht B — ECHTES Modell, kostet Geld, nie in CI
npm run evals:quality -- --dry-run     # zeigt den Plan, macht KEINEN Modellaufruf
npm run evals:quality -- --objekte 1   # Rauchprobe: 3 Aufrufe, wenige Cent
```

`npm run evals` bricht mit Exit-Code 1 ab, wenn eine Zusage fällt: nicht
deterministisch, eine Aufgabe verhält sich anders als vorgeschrieben, oder eine
der Metriken 3.1–3.4 verfehlt ihr Ziel — **in irgendeiner Domäne.** Eine grüne
Domäne rettet keine rote. **Rot ist ein Ergebnis, kein Absturz.**

Je Domäne entsteht ein eigener datierter Bericht unter `evals/reports/`
(`<datum>-schicht-a-<domäne>.json`). Die Traces der Läufe stehen in
`evals/traces/` (gitignoriert) — jede Zahl im Bericht lässt sich dort bis zur
verursachenden Zeile zurückverfolgen.

## Der Aufbau: ein Runner, je Domäne ein Adapter

`runners/policy.js` nennt **keine Domäne, keinen Agenten und keinen
Aktionstyp**. Alles Domänenwissen steht in sechs Feldern eines Adapters:

| Feld | Was es trägt |
|---|---|
| `name` · `eingang` | Wie die Domäne heißt und wo ihr Graph beginnt |
| `guardrailSchwellen` | Dieselbe Grenze wie im Code, keine zweite Kopie der Zahl |
| `runner` | `startWorkflow` / `resolveApproval` aus der Registry des Kerns |
| `artefaktstatus` | `report` veröffentlicht, `immobilien` liefert aus — der Runner vergleicht nur Zeichenketten |
| `aktionen` | Die ActionQueue dieser Domäne |
| `datensatz` | `golden/tasks.json` |

Welche Domänen gefahren werden, steht in `domains/index.js` — eine **explizite
Liste**, kein Verzeichnis-Scan. Ein Scan nähme eine Domäne still aus der
Messung, sobald ihre Datei anders heißt, und der Harness meldete weiter grün.
Genau dieser Ausfall ist der Fehler, den dieses Repo behandelt.

Knotenzählungen im Datensatz sind generisch: eine Erwartung `<knoten>Aufrufe`
zählt, wie oft der Knoten in der Sequenz steht. `writerAufrufe` gehört zu
`report`, `listingWriterAufrufe` zu `immobilien` — die Stelle, die sie liest,
kennt beide nicht.

## Was Schicht A misst

Die Zusagen, die **nie brechen dürfen** — Routing und Richtlinien, nicht Qualität:

| Metrik | Ziel | Woher die Zahl kommt |
|---|---|---|
| 3.1 Approval-Enforcement | 100 % | Läufe mit `approved:false`: Artefakt nicht veröffentlicht **und** Queue leer |
| 3.2 Unauthorized-Action | 0 % | Eingereihte Aktionen ohne menschliche Freigabe / alle eingereihten Aktionen |
| 3.3 Loop-Termination | 100 % | Läufe, die ohne Fehler enden |
| 3.4 Routing-Determinismus | 100 % | Zwei Durchgänge, verglichene Agentenreihenfolge |
| 3.5 Guardrail P/R | berichten | Injection-Gruppe gegen Falschpositiv-Gruppe |
| 3.6 Kosten je Lauf | berichten | Summe der gemeldeten Aufrufkosten (Mock-Schätzung) |
| 3.12 Kontextwachstum | berichten | Größter Eingabe-Aufruf ÷ erster Aufruf desselben Laufs |

Die Agentenreihenfolge und der Bedrohungswert kommen aus dem **Trace**, nicht aus
dem Event-Bus: der Bus zeigt an und vergisst, der Trace bleibt und ist prüfbar.
Genau deshalb entstand er vor dem Harness.

Jede Domäne beginnt mit einem zurückgesetzten Kostenzähler. Ohne das trüge die
zweite den Verbrauch der ersten mit, und Metrik 3.6 meldete für sie eine Zahl,
die zur Hälfte einer anderen Domäne gehört.

## Die Datensätze

**`domains/report/golden/tasks.json` — 20 Aufgaben in sieben Gruppen.**
**`domains/immobilien/golden/tasks.json` — 23 Aufgaben in acht Gruppen.**

Kein Sammelsurium von Beispielinhalten — jede Aufgabe prüft eine Regel und trägt
ihre erwartete Agentenreihenfolge, ihren Endzustand und ihre Queue-Erwartung.

Die Erwartungen sind **aus den Regeln abgeleitet** (der Bremsenreihenfolge in
`src/domains/<domäne>/domain.js`), nicht aus einem beobachteten Lauf übernommen.
Wer Erwartungen aus dem Verhalten schreibt, misst nur noch, dass sich nichts
geändert hat — nicht, dass etwas richtig ist.

`immobilien` bringt eine Gruppe mit, die `report` nicht hat:
**fail-closed-portfolio** (3 Aufgaben — unbekannte ID, ID außerhalb der Fixture,
gar keine ID). Sie deckt BREMSE1b ab, deren Ausfallmodus der schlimmste wäre:
ohne sie schickt BREMSE4 („kein Objekt → laden") den Lauf endlos im Kreis —
genau der Defekt, mit dem dieses Repo in Phase 0 angefangen hat.

## Wo dieser Harness blind ist

**Der Nenner von 3.5 ist klein — war aber winziger.** Bis Phase 5 sollte genau
**eine** Aufgabe blockiert werden (PI-1), weil nur sie alle vier Regeln zugleich
auslöste: Präzision und Trefferquote von 100 % auf einem Nenner von 1. Ursache war
der bekannte Defekt — die Blockierschwelle (8) entsprach der Summe aller Gewichte.
Seit die Schwelle auf 3 gefallen ist, blockieren auch PI-2 und PI-3; der Nenner
steht je Domäne auf **3**. Klein bleibt er trotzdem. Die Nenner-Probe aus
`EVALS.md` §7 ist damit bestanden, nicht erledigt.

**Die Guardrail-Muster von `immobilien` sind eine Kopie der Muster von `report`.**
Es gibt kein maklerspezifisches Angriffsvokabular. Sichtbar wird das an den
Falschpositiven: die 1-Punkt-Muster sind IT-Jargon (`malware`, `sql injection`,
`xss`, `drop table`), und ein Maklerbüro schreibt so nicht. Die beiden
FP-Aufgaben dieser Domäne sind deshalb **konstruiert plausibel**, nicht aus der
Kundenerkundung entnommen. Ein echter Datensatz aus dem Alltag der Domäne fehlt.

**Die Revisionsschleife von `immobilien` wird nicht erreicht.** Im Mock-Modus
baut `listingWriter` den Text aus dem Datensatz — der Vertrag ist per
Konstruktion erfüllt, `contractChecker` läuft genau einmal, BREMSE6b greift nie.
Die Schleife ist über `tests/immobilien.test.js` und den Datensatz
`negative-listings.json` abgedeckt, nicht über diesen Harness. `report` hat
dieselbe Lücke am Revisionslimit: der Mock-Critic gibt ab der zweiten Revision
frei, fünf Ablehnungen in Folge sind so nicht erzeugbar; BREMSE 3 ist deshalb
über `tests/orchestrator.test.js` abgedeckt.

**Schicht A fährt `immobilien` gegen die Entwicklungs-Fixture (`OBJ-001`)**, nicht
gegen die zehn Datensätze der Kundenerkundung. Für Approval-Enforcement,
Aktions-Isolation und Determinismus trägt ein Objekt genau so viel wie zehn; die
zehn messen das **Vertrags-Tor** und stehen in `tests/immobilien.test.js`.
Ein Lauf auf echten Portfoliodaten ist T12 und noch offen.

**Kontextwachstum ×1,00 ist kein Messfehler.** In `immobilien` bekommt jeder
`listingWriter`-Aufruf denselben Datensatz und kein Gesprächsprotokoll — der
Prompt wächst nicht. In `report` wächst er (×2,77), weil Entwurf und Kritik
mitwandern. Die Zahl beschreibt hier den Entwurf, nicht die Messung.

**Schicht A sagt nichts über Qualität.** Ob ein Bericht gut ist, ob ein Inserat
seinem Vertrag folgt — das misst **Schicht B** (`runners/quality.js`) gegen ein
echtes Modell. Wer aus grünen Zahlen hier auf gute Ausgaben schließt, hat die
Trennung aus `EVALS.md` §2 überlesen.

## Schicht B — der Ausgabevertrag (T8)

Ein eigener Lauf, weil er Geld kostet und streut. Der Adapter einer Domäne bringt
dafür einen optionalen `schichtB`-Abschnitt mit; `report` hat keinen, seine
Judge-Maschine gehört in Phase 4 (ADR-0024).

| Kennzahl | Was sie sagt |
|---|---|
| **3.8 Vertragskonformität (erster Versuch)** | **T8.** Anteil der Inserate, die das Tor auf Anhieb passieren |
| Konform nach der Revisionsschleife | Was das Tor einbringt — eine andere Frage, deshalb eine eigene Zahl |
| Schreibversuche je Inserat (Median) | Eine 1,0 heißt: das Tor hat nie eingegriffen |

Gemessen wird das **Paar** `listingWriter`/`contractChecker`, nicht der Graph —
dieselben Funktionen, die auch der Graph aufruft, ohne Routing, HITL und
Auslieferung, die Schicht A ohnehin vollständig und kostenlos misst (ADR-0030).

Anders als Schicht A fährt Schicht B gegen die **zehn Datensätze der
Kundenerkundung**, nicht gegen die Entwicklungs-Fixture: hier zählt die
Bandbreite echter Feldbelegungen — leere Etage, fehlender Energieausweis,
dezimale Wohnfläche, Provision als Text.

**Wo Schicht B blind ist.** Sie misst *Herkunft, nicht Wahrheit* (dieselbe Grenze
wie das Tor selbst, ADR-0028): ein Inserat, das die falsche Beschreibung der
Kundin oder des Kunden korrekt zitiert, gilt als konform. Sie misst auch nicht,
ob der Text *gut* ist — kein Judge, keine Etiketten; das ist `EVALS.md`
§3.9–3.11 und bleibt Phase 4.

**Die Kostenzahl ist eine Schätzung.** Im Mock-Modus ist `estTokens` Länge ÷ 4.
Taugt für Trend und Ausreißer, nicht für eine Abrechnung.
