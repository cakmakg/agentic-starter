# evals — was hier gemessen wird, und was nicht

Die Definitionen stehen in [`EVALS.md`](../EVALS.md). Diese Datei sagt, was der
Harness **tatsächlich** tut, und vor allem: **wo er blind ist.** Ein Rahmen, der
seine Grenzen verschweigt, ist gefährlicher als keiner.

## Ausführen

```bash
npm run evals            # Schicht A — Mock, deterministisch, kostenlos, CI-tauglich
npm run evals:quality    # ⏳ Phase 4 — Schicht B, echtes Modell, kostet Geld
```

`npm run evals` bricht mit Exit-Code 1 ab, wenn eine Zusage fällt: nicht
deterministisch, eine Aufgabe verhält sich anders als vorgeschrieben, oder eine
der Metriken 3.1–3.4 verfehlt ihr Ziel. **Rot ist ein Ergebnis, kein Absturz.**

Der Bericht landet datiert unter `evals/reports/`. Die Traces der Läufe stehen in
`evals/traces/` (gitignoriert) — jede Zahl im Bericht lässt sich dort bis zur
verursachenden Zeile zurückverfolgen.

## Was Schicht A misst

Die Zusagen, die **nie brechen dürfen** — Routing und Richtlinien, nicht Qualität:

| Metrik | Ziel | Woher die Zahl kommt |
|---|---|---|
| 3.1 Approval-Enforcement | 100 % | Läufe mit `approved:false`: Artefakt nicht `PUBLISHED` **und** Queue leer |
| 3.2 Unauthorized-Action | 0 % | Eingereihte Aktionen ohne menschliche Freigabe / alle eingereihten Aktionen |
| 3.3 Loop-Termination | 100 % | Läufe, die ohne Fehler enden |
| 3.4 Routing-Determinismus | 100 % | Zwei Durchgänge, verglichene Agentenreihenfolge |
| 3.5 Guardrail P/R | berichten | Injection-Gruppe gegen Falschpositiv-Gruppe |
| 3.6 Kosten je Lauf | berichten | Summe der gemeldeten Aufrufkosten (Mock-Schätzung) |
| 3.12 Kontextwachstum | berichten | Größter Eingabe-Aufruf ÷ erster Aufruf desselben Laufs |

Die Agentenreihenfolge und der Bedrohungswert kommen aus dem **Trace**, nicht aus
dem Event-Bus: der Bus zeigt an und vergisst, der Trace bleibt und ist prüfbar.
Genau deshalb entstand er vor dem Harness.

## Der Datensatz

20 Aufgaben in sieben Gruppen (`domains/report/golden/tasks.json`). Kein
Sammelsurium von Beispielinhalten — jede Aufgabe prüft eine Regel und trägt ihre
erwartete Agentenreihenfolge, ihren Endzustand und ihre Queue-Erwartung.

Die Erwartungen sind **aus den Regeln abgeleitet** (der Bremsenreihenfolge in
`src/domains/report/domain.js`), nicht aus einem beobachteten Lauf übernommen.
Wer Erwartungen aus dem Verhalten schreibt, misst nur noch, dass sich nichts
geändert hat — nicht, dass etwas richtig ist.

## Wo dieser Harness blind ist

**Der Nenner von 3.5 ist klein — war aber winziger.** Bis Phase 5 sollte genau
**eine** Aufgabe blockiert werden (PI-1), weil nur sie alle vier Regeln zugleich
auslöste: Präzision und Trefferquote von 100 % auf einem Nenner von 1. Ursache war
der bekannte Defekt — die Blockierschwelle (8) entsprach der Summe aller Gewichte.
Seit die Schwelle auf 3 gefallen ist, blockieren auch PI-2 und PI-3; der Nenner
steht auf **3**. Klein bleibt er trotzdem. Die Nenner-Probe aus `EVALS.md` §7 ist
damit bestanden, nicht erledigt.

**Das Revisionslimit wird nicht erreicht.** Der Mock-Critic gibt ab der zweiten
Revision frei; fünf Ablehnungen in Folge sind so nicht erzeugbar. BREMSE 3 ist
deshalb über `tests/orchestrator.test.js` abgedeckt, nicht über diesen Harness.

**Schicht A sagt nichts über Qualität.** Ob ein Bericht gut ist, ob eine Aussage
aus ihrem Beleg folgt — das misst Schicht B gegen ein echtes Modell, ab Phase 4
(ADR-0024). Wer aus grünen Zahlen hier auf gute Ausgaben schließt, hat die
Trennung aus `EVALS.md` §2 überlesen.

**Die Kostenzahl ist eine Schätzung.** Im Mock-Modus ist `estTokens` Länge ÷ 4.
Taugt für Trend und Ausreißer, nicht für eine Abrechnung.
