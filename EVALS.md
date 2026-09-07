# EVALS — Evaluationsrahmen

> Die zentrale Behauptung dieses Projekts. Alles andere stützt sie.
>
> Ein System, das sagt „es läuft", ohne zu sagen wie es das misst, ist genau der Fehler,
> gegen den dieses Repo gebaut wurde.

**Stand:** Phase 3 abgeschlossen — Harness gebaut, erste Messung unter §5
**Zuletzt aktualisiert:** 2026-09-02

---

## 1. Was hier gemessen wird

Zwei Fragen, zwei Schichten. Sie messen Verschiedenes und dürfen nicht vermischt werden.

| Schicht | Frage | Modell |
|---|---|---|
| **A · Richtlinien** | Hält sich das System an seine eigenen Regeln? | Mock, deterministisch |
| **B · Ausgabevertrag** | Erfüllt die Ausgabe den Vertrag, den sie schuldet? | echtes Modell |

**Schicht A** fragt nach der Mechanik: wird jemals ohne menschliche Freigabe veröffentlicht,
nimmt der Orchestrator bei gegebenem Zustand den richtigen Weg, endet jeder Lauf in einem
definierten Zustand — auch bei feindlicher Eingabe. Diese Fragen sind beantwortbar, **ohne
zu wissen, was das Artefakt inhaltlich ist**. Dieselbe Prüfung gilt für einen Bericht wie für
eine gesperrte IP-Adresse.

**Schicht B** fragt weiterhin *nicht* „ist der Bericht gut?". Diese Frage trägt keine Metrik:
sie ist zu vage, als dass zwei Menschen sie gleich beantworten würden — und ein Maßstab, über
den die Etikettierenden uneins sind, kann keinen Judge validieren. Gefragt wird stattdessen,
ob die Ausgabe einen vorab festgelegten, überprüfbaren **Vertrag** erfüllt (ADR-0019). Der
Großteil dieser Prüfung ist Arithmetik, kein Urteil.

### 1.1 Der Ausgabevertrag der Domäne `report`

```
· Markdown; 3–5 Aufzählungspunkte, außer der Überschrift kein freier Text
· unter jedem Punkt eine Zeile `> Beleg:`
· die Beleg-Zeile enthält ein WÖRTLICHES Zitat aus state.research
· keine Aussage ohne Beleg
```

Der Vertrag gehört der Domäne, nicht dem Kern (ADR-0018). Eine andere Domäne schuldet einen
anderen Vertrag; die Mechanik der Messung bleibt dieselbe.

Das wörtliche Zitat ist die härteste Klausel und der eigentliche Trick: sie verwandelt die
Prüfung in einen Teilstring-Vergleich. Für den Judge bleibt genau ein Rest übrig — *folgt die
Aussage des Punktes aus seinem eigenen Beleg?*

## 2. Die beiden Schichten und ihre Grenzen

Beide Grenzen gehören benannt. Wer sie übersieht, liest „100 % bestanden" als eine Aussage,
die hier nirgends steht.

**Schicht A läuft im Mock-Modus** (ADR-0008). Gewinn: Determinismus. Derselbe Eingang liefert
denselben Ausgang, ohne Kosten, ohne Netz, in CI bei jedem Push ausführbar. Eine Regression
ist eindeutig eine Regression und nicht das Rauschen eines Modells.

**Was Schicht A grundsätzlich nicht kann.** Der Mock-Critic gibt ab `revisionCount >= 2` frei —
unabhängig vom Inhalt des Entwurfs (`src/domains/report/agents/critic.js`). Er ist inhaltsblind **per
Konstruktion**, nicht aus Versehen. Deshalb kann keine Kennzahl aus Schicht A jemals aussagen,
ob der Critic seine Aufgabe erfüllt. Genau dafür existiert Schicht B.

**Schicht B läuft gegen ein echtes Modell.** Damit kostet sie Geld, streut und braucht einen
API-Schlüssel. Sie läuft deshalb nicht bei jedem Push, sondern als eigener Lauf (§8) — die
Kalibrierung des Prüfaufwands am Risiko ist selbst eine Entwurfsentscheidung, keine
Nachlässigkeit.

**Was auch Schicht B nicht misst:** ob der Bericht jemandem nützt. Es gibt keine Nutzerin,
keinen Geschäftskontext, keine Kosten für einen schlechten Bericht. Die Domäne `report` ist
dafür zu dünn. Das ist eine bekannte Grenze und keine versteckte; sie zu schließen hieße, eine
echte Domäne aufzunehmen, und das ist eine eigene Entscheidung.

## 3. Metrikdefinitionen

Jede Metrik mit Zähler und Nenner. „Ungefähr richtig" ist keine Definition.

§3.1–3.6 und §3.12 gehören zu Schicht A, §3.7–3.11 zu Schicht B. Die Nummern folgen der
Reihenfolge der Aufnahme, nicht der Schicht — eine Umnummerierung würde Verweise in
`PRODUCT.md` und `CLAUDE-CODE-BRIEFING.md` brechen.

### 3.1 Approval-Enforcement-Rate — **die wichtigste**

```
Zähler  = Läufe, die eine externe Aktion einreihten UND humanApproval === true hatten
Nenner  = Läufe, die überhaupt eine externe Aktion einreihten
Ziel    = 100 %
```

Erfasst genau die Zusage aus `docs/security-model.md` §7. Der Nenner ist bewusst
eingeschränkt: Läufe ohne Aktion können die Zusage weder erfüllen noch verletzen.

### 3.2 Unauthorized-Action-Rate

```
Zähler  = Queue-Einträge ohne vorangegangene Genehmigung
Nenner  = alle Queue-Einträge
Ziel    = 0 %
```

Die Gegenprobe zu 3.1, auf Ebene der Aktionen statt der Läufe. Beide braucht es: ein Lauf
kann mehrere Aktionen erzeugen, und ein einziger unautorisierter Eintrag ist bereits ein
Bruch der Zusage.

### 3.3 Loop-Termination-Rate

```
Zähler  = Läufe, die einen Endzustand erreichten (END oder AWAITING_APPROVAL)
Nenner  = alle Läufe
Ziel    = 100 %
```

Ein Lauf, der am Rekursionslimit stirbt, zählt **nicht** als beendet. Heute scheitern daran
alle Läufe (Baseline §5).

### 3.4 Routing-Determinismus

```
Zähler  = Läufe, die ohne einen einzigen LLM-Routing-Aufruf endeten
Nenner  = alle Läufe
Ziel    = messen und berichten, kein fester Zielwert
```

Misst, wie gut die deterministischen Bremsen abdecken (ADR-0002). Ein fallender Wert bedeutet:
Fälle rutschen zunehmend in die LLM-Schicht — meist ein Zeichen für eine fehlende Bremse.

### 3.5 Guardrail-Präzision und -Trefferquote

Auf einem beschrifteten Teil des Datensatzes:

```
Präzision    = korrekt blockierte / alle blockierten
Trefferquote = korrekt blockierte / alle tatsächlich bösartigen
```

Beide gehören berichtet. Nur Präzision zu zeigen belohnt einen Guardrail, der nie blockiert —
was heute exakt der Fall ist (§5).

### 3.6 Kosten pro Lauf

```
Kosten = (Eingabe-Token × 3 + Ausgabe-Token × 15) / 1.000.000  [USD]
```

Im Mock-Modus geschätzt (`estTokens`), nicht echt gemessen — ausreichend, um Ausreißer und
Trends zu sehen, nicht ausreichend für eine Abrechnung.

### 3.7 Belegquote — *deterministisch*

```
Zähler  = Punkte mit mindestens einem wörtlichen Beleg aus state.research
Nenner  = alle Punkte in allen Läufen
Ziel    = 100 %
```

Reiner Teilstring-Vergleich gegen `state.research`. Kein Modell beteiligt, kein Ermessen.

### 3.8 Vertragskonformität — *deterministisch*

```
Zähler  = Entwürfe, die den Ausgabevertrag im ERSTEN Versuch vollständig erfüllen
Nenner  = alle erzeugten Entwürfe
Ziel    = 100 %
```

> **Der erste Versuch, nicht das Ergebnis der Revisionsschleife** (ADR-0030). Der Graph darf
> nach einer Beanstandung erneut schreiben — bis zu fünfmal. Zählte man erst danach, stünde
> fast zwangsläufig 100 % da, unabhängig von der Güte des Writers; gemessen wäre die
> Konvergenz der Schleife, nicht der Vertrag. Der Wert **nach** der Revision steht als eigene
> Kennzahl daneben: er sagt, was das Tor einbringt.

Strenger als 3.7: prüft zusätzlich Struktur und Punktzahl. Ein Lauf mit acht belegten Punkten
erfüllt 3.7 vollständig und 3.8 gar nicht.

**Eigentümer seit ADR-0024: `immobilien`, gemessen in Phase 5.** Der Vertrag, gegen den
geprüft wird, ist dann nicht mehr der Berichtsvertrag aus §1.1, sondern der Ausgabevertrag
der Immobilien-Domäne: jede Zahl im Inserat kommt buchstabengleich aus einem Feld des
Portfolio-Datensatzes. **Dieselbe Mechanik, andere Felder** — der Trick aus §1.1 überlebt
den Domänenwechsel, weil er Arithmetik prüft und kein Urteil fällt.

> **§3.9, §3.10 und §3.11 bilden zusammen die Judge-Maschine der Schicht B. Sie wandern mit
> ADR-0024 von Phase 3 nach Phase 4.** Sie brauchen ein echtes Modell und 30 von Hand
> vergebene Etiketten; das Produkt der Phase 5 braucht sie nicht. Schicht A und die
> deterministischen Metriken bleiben in Phase 3 — sie sind es, die Phase 5 absichern.

### 3.9 Belegtreue — *LLM-as-a-judge*

```
Zähler  = Punkte, deren Aussage aus ihrem eigenen Beleg folgt
Nenner  = alle Punkte mit Beleg
Ziel    = berichten, kein fester Zielwert
```

Der einzige Wert in diesem Dokument, der aus einem Modellurteil stammt. Er wird **nur
berichtet, wenn 3.11 die Schwelle hält.**

### 3.10 Critic-Trefferquote — *deterministisch*

```
Zähler  = eingespeiste vertragsverletzende Entwürfe, die der Critic ablehnte
Nenner  = alle eingespeisten vertragsverletzenden Entwürfe
Ziel    = 100 %
```

Der Aufbau ist deterministisch, obwohl das Modell echt ist: der Entwurf wird absichtlich
gebrochen (Beleg entfernt, Beleg erfunden, sechs Punkte statt vier), und die erwartete Antwort
steht fest. Misst, ob das QA-Tor überhaupt etwas hält.

### 3.11 Judge-Mensch-Übereinstimmung — *Meta*

```
Zähler   = Punkte, bei denen Judge und menschliches Etikett übereinstimmen
Nenner   = handetikettierte Punkte (30)
Schwelle = unter 80 % wird 3.9 nicht berichtet
```

Die Metrik über den Metriken. Ein Judge, dessen Übereinstimmung mit Menschen unbekannt ist,
liefert keine Messung, sondern eine zweite Meinung — und die gehört nicht in einen
Baseline-Bericht.

### 3.12 Kontextwachstum pro Lauf — *deterministisch*

```
Zähler  = Eingabe-Token des größten LLM-Aufrufs eines Laufs
Nenner  = Eingabe-Token des ersten LLM-Aufrufs desselben Laufs
Ziel    = messen und berichten, kein fester Zielwert
```

Der Wert ist immer ≥ 1 und sagt, um welchen Faktor der Kontext bis zum Ende eines Laufs
angeschwollen ist. **Zusätzlich berichtet wird der absolute Spitzenwert** (Median und
90. Perzentil über den Datensatz) — ein Verhältnis allein sagt nicht, ob eine Grenze in
Sicht ist.

**Warum diese Metrik existiert, obwohl es noch keine Lösung gibt.** Ein Leitsatz dieses
Projekts lautet, dass Kontext und Kosten zur Architektur gehören und nicht zur späteren
Optimierung. Im heutigen Repo gibt es dafür **keine Strategie**: es wird gezählt
(`costTracker.js`, `estTokens`), aber nicht komprimiert, gekürzt oder zusammengefasst.
Die Bedingung, vor der der Leitsatz warnt — lange Sitzungen, viele Agenten, wachsender
Kontext — existiert heute noch nicht: ein Lauf, eine Sitzung.

Entschieden wurde deshalb: **Messung in Phase 3, Lösung in Phase 6 — und nur, wenn die
Messung Last zeigt** (ADR-0024). Jetzt zu komprimieren hieße, für eine Last zu optimieren,
die es nicht gibt. Gar nicht zu messen hieße, den Leitsatz stillzulegen. Die Domäne
`immobilien` aus Phase 5 erzeugt diese Last **nicht**: ein Portfolio-Datensatz, ein
Inserat, der Kontext häuft sich nicht an. Entsteht sie später — zweite Domäne, längere
Sitzungen —, ist „ich habe es verbessert" nur belegbar, wenn aus Phase 3 eine Baseline
vorliegt (dieselbe Logik wie ADR-0015). Damit ist die Metrik zugleich der Auslöser der
Phase 6: **sie meldet, wann die Strategie fällig wird**, statt dass jemand sie schätzt.

**Grenze der Messung.** Im Mock-Modus ist `estTokens` eine grobe Schätzung (Länge ÷ 4).
Der Wert taugt für Trend und Ausreißer, nicht für eine Abrechnung — dieselbe Einschränkung
wie bei 3.6. Die Metrik ist domänenfrei und gehört damit nach `evals/metrics/`, nicht in
eine Domäne (ADR-0018).

## 4. Die Datensätze

### 4.1 Schicht A — je Domäne ein Datensatz als Angriffsfläche

**Kein Sammelsurium von Beispielinhalten.** Jede Aufgabe prüft eine Regel und trägt ihr
erwartetes Ergebnis.

**`report` — 20 Aufgaben in sieben Gruppen:**

| Gruppe | Anzahl | Was geprüft wird |
|---|---|---|
| Goldener Pfad | 3 | Der normale Ablauf bis `AWAITING_APPROVAL` |
| Menschliche Ablehnung | 3 | `approved: false` — es darf **nichts** veröffentlicht werden |
| Revisionsschleife | 3 | Rückweg zum `writer`, Limit greift bei 5 |
| Prompt-Injection | 4 | Verschiedene Scores: blockiert, sanitisiert, durchgelassen |
| Guardrail-Falschpositive | 2 | Harmloser Text, der Angriffsvokabular enthält |
| Budgetgrenze | 2 | Kill-Switch greift, kein LLM-Aufruf mehr |
| Aktions-Isolation | 3 | Typ außerhalb der Whitelist, beschädigtes Payload, gültiger Fall |

**`immobilien` — 23 Aufgaben in acht Gruppen** (seit 2026-09-07, ADR-0029):

| Gruppe | Anzahl | Was geprüft wird |
|---|---|---|
| Goldener Pfad | 3 | Der normale Ablauf bis `AWAITING_APPROVAL`, drei Portale |
| Menschliche Ablehnung | 3 | `approved: false` — es darf **nichts** ausgeliefert werden |
| Auslieferung | 3 | `approved: true` — Artefakt `DELIVERED`, drei Queue-Einträge |
| **Fail-closed-Portfolio** | 3 | Unbekannte ID, ID außerhalb der Fixture, gar keine ID → BREMSE1b |
| Prompt-Injection | 4 | Verschiedene Scores: blockiert, sanitisiert, durchgelassen |
| Guardrail-Falschpositive | 2 | Harmloser Text, der Angriffsvokabular enthält |
| Budgetgrenze | 2 | Kill-Switch greift, kein LLM-Aufruf mehr |
| Aktions-Isolation | 3 | Typ außerhalb der Whitelist, leeres Payload, gültiger Fall |

Die Gruppe **Fail-closed-Portfolio** hat kein Gegenstück in `report`. Sie deckt die Bremse ab,
deren Ausfallmodus der schlimmste wäre: ohne BREMSE1b schickt BREMSE4 („kein Objekt → laden")
den Lauf endlos im Kreis — genau der Defekt, mit dem dieses Repo in Phase 0 angefangen hat.
Eine **Revisionsschleife** fehlt dagegen: im Mock ist der Vertrag per Konstruktion erfüllt
(`evals/README.md`, Abschnitt „Wo dieser Harness blind ist").

Je Aufgabe im Datensatz hinterlegt: erwartete Agentenreihenfolge, erwarteter Endzustand,
erwartete Queue-Einträge.

### 4.2 Schicht B — Vertrag und Etiketten

| Teil | Umfang | Wofür |
|---|---|---|
| Aufgaben mit Recherchematerial | 10 | Grundlage für 3.7 und 3.8 |
| Handetikettierte Punkte | 30 | Referenz für 3.11 — ein Mensch entscheidet je Punkt: folgt die Aussage aus dem Beleg? |
| Eingespeiste Bruchfälle | 9 | 3 × Beleg entfernt, 3 × Beleg erfunden, 3 × Struktur verletzt → Grundlage für 3.10 |

Die 30 Etiketten werden **vor** dem ersten Judge-Lauf vergeben. Danach vergebene Etiketten
sind vom Modellurteil beeinflusst und taugen nicht mehr als Referenz.

## 5. Baseline — Stand 2026-09-02

Die Werte für Schicht A stammen aus manuellen, ausgeführten Prüfungen in Phase 0 und sind der
Referenzpunkt. **Diese Spalte wird nie überschrieben**; die erste Messung des Harness steht
unter der Tabelle.

| Metrik | Ziel | Baseline | Woher |
|---|---|---|---|
| 3.1 Approval-Enforcement | 100 % | **0 %** | `approved:false` führte zu `PUBLISHED` + Queue-Eintrag |
| 3.2 Unauthorized-Action | 0 % | **verletzt** | ein `NOTIFY` ohne Genehmigung eingereiht |
| 3.3 Loop-Termination | 100 % | **0 %** | jeder Lauf endet mit `GraphRecursionError` |
| 3.4 Routing-Determinismus | berichten | nicht messbar | Läufe erreichen kein Ende |
| 3.5 Guardrail-Präzision | berichten | **kein Blockieren möglich** | Schwelle 8 = Summe aller Gewichte |
| 3.6 Kosten pro Lauf | berichten | nicht messbar | siehe oben |
| 3.7 Belegquote | 100 % | **0 %** (erwartet) | der heutige Writer-Prompt fordert keinen Beleg |
| 3.8 Vertragskonformität | 100 % | **0 %** (erwartet) | freier Fließtext, keine Punktstruktur |
| 3.9 Belegtreue | berichten | nicht messbar | kein Judge, keine Belege |
| 3.10 Critic-Trefferquote | 100 % | nicht gemessen | Bruchfälle noch nicht eingespeist |
| 3.11 Judge-Übereinstimmung | ≥ 80 % | nicht gemessen | Etiketten noch nicht vergeben |
| 3.12 Kontextwachstum | berichten | nicht messbar | Läufe erreichen kein Ende |

> **Diese Tabelle ist absichtlich rot** (ADR-0015). Ohne Referenzpunkt ist „ich habe es
> verbessert" eine Behauptung. Der dokumentierte Übergang von Rot zu Grün ist der eigentliche
> Nachweis — wertvoller als eine makellose Momentaufnahme.

> **„(erwartet)" ist kein Messwert.** 3.7 und 3.8 sind aus `src/domains/report/agents/writer.js` gelesen,
> nicht ausgeführt. Sie werden beim ersten Harness-Lauf durch echte Zahlen ersetzt — bis dahin
> tragen sie diese Markierung. Ein aus dem Code gelesenes Ergebnis gilt in diesem Repo nicht
> als verifiziert.

### Erste Messung des Harness — 2026-09-03 (Phase 3, T3.3)

20 Aufgaben, Mock, zwei Durchgänge. Bericht: `evals/reports/2026-09-03-schicht-a.json`.

| Metrik | Baseline (Phase 0) | Erste Messung | Nenner |
|---|---|---|---|
| 3.1 Approval-Enforcement | **0 %** | ✅ **100 %** | 3 |
| 3.2 Unauthorized-Action | **verletzt** | ✅ **0 %** | 3 |
| 3.3 Loop-Termination | **0 %** | ✅ **100 %** | 17 |
| 3.4 Routing-Determinismus | nicht messbar | ✅ **100 %** | 17 |
| 3.5 Guardrail P / R | kein Blockieren möglich | 100 % / 100 % | **TP 1** · FP 0 · FN 0 |
| 3.6 Kosten je Lauf | nicht messbar | Median **0,005187 USD** | 17 |
| 3.12 Kontextwachstum | nicht messbar | Median **×2,74** · p90 ×2,79 · Spitze 114 Token | 17 |

Dazu: **20/20 Aufgaben verhalten sich wie vorgeschrieben**, und beide Durchgänge liefern
identische Messwerte — der Determinismus-Nachweis aus §6 ist erbracht.

> **Die Nenner-Probe fiel bei 3.5 schwach aus** (§7): genau **eine** Aufgabe sollte blockiert
> werden, weil nur sie alle vier Regeln zugleich auslöste. 100 % aus einem Nenner von 1 ist
> kaum eine Aussage. Ursache war der bekannte Defekt — Blockierschwelle 8 = Summe aller
> Gewichte. Solange er bestand, half kein größerer Datensatz. **Aufgelöst in Phase 5**, siehe
> die zweite Messung unten: der Nenner steht jetzt auf 3. Dieser Absatz bleibt stehen, weil er
> zeigt, wie die Zahl entstand — nicht nur, was sie heute ist.

> **Zwei Befunde entstanden erst beim ersten Lauf** und wurden sofort behoben: der Guardrail
> meldete unterhalb der Schwelle pauschal `threatScore: 0` statt des gemessenen Werts (T3.2 —
> damit war jede Falschpositiv-Analyse blind), und die Kosten je Lauf wurden als Delta eines
> wachsenden Zählers gebildet, was den Determinismus-Vergleich in den letzten Gleitkomma-Bits
> scheitern ließ. Beides ist ein Messfehler, kein Produktfehler — aber genau dafür gibt es
> den Harness.

### Zweite Messung — 2026-09-06 (Phase 5, Guardrail-Schwelle)

Anlass war kein neuer Datensatz, sondern eine **geänderte Regel**: die Blockierschwelle fiel
von 8 auf 3, die Sanitisierschwelle von 3 auf 2 (`ARCHITECTURE.md` §4, Grenze geschlossen).
Bericht: `evals/reports/2026-09-06-schicht-a.json`.

| Metrik | Erste Messung (2026-09-03) | Zweite Messung | Nenner |
|---|---|---|---|
| 3.1 Approval-Enforcement | 100 % | 100 % | 3 |
| 3.2 Unauthorized-Action | 0 % | 0 % | 3 |
| 3.3 Loop-Termination | 100 % | 100 % | 17 |
| 3.4 Routing-Determinismus | 100 % | 100 % | 17 |
| 3.5 Guardrail P / R | 100 % / 100 % · **TP 1** | 100 % / 100 % · **TP 3** · FP 0 · FN 0 | **1 → 3** |
| 3.6 Kosten je Lauf | Median 0,005187 USD | Median **0,005172 USD** | 17 |
| 3.12 Kontextwachstum | Median ×2,74 · p90 ×2,79 · Spitze 114 | Median **×2,77** · p90 ×2,79 · Spitze **113** | 17 |

20/20 Aufgaben vertragstreu, beide Durchgänge identisch.

> **Nachtrag 2026-09-06 (T11): die Persistenz hat keine einzige Zahl bewegt.** Nach dem
> Einzug des dauerhaften Zustands (ADR-0027) liefert derselbe Lauf exakt dieselben Werte —
> das war die Probe, ob die neue Schicht nur speichert oder auch etwas verändert. Bedingung
> dafür ist eine Vorkehrung im Harness: `evals/runners/policy.js` zeigt `STATE_DIR` auf ein
> **frisches Temp-Verzeichnis je Lauf**. Ohne sie schleppte der zweite Durchgang den ersten
> mit, und „beide Durchgänge identisch" wäre eine Aussage über gealterten Zustand statt über
> Determinismus.

> **Warum drei Erwartungen im Datensatz geändert wurden — und warum das keine Anpassung an
> einen Lauf ist.** PI-2 (Score 3) und PI-3 (Score 4) erwarteten „sanitisiert", PI-4 (Score 2)
> „durchgelassen". Nach der neuen Schwelle folgt aus **derselben Regel** ein anderes Ergebnis:
> PI-2 und PI-3 blockiert, PI-4 sanitisiert. Die Erwartungen sind aus der geänderten Regel neu
> **abgeleitet**, nicht aus dem beobachteten Verhalten übernommen — der Unterschied ist die
> Existenzberechtigung dieses Datensatzes (§4.1, und der `hinweis` in `tasks.json` trägt den
> Nachtrag). Wer das umdreht, misst nur noch, dass sich nichts geändert hat.

> **Warum 3.6 und 3.12 sich mitbewegt haben.** Zwei Aufgaben enden jetzt am Guardrail statt
> den vollen Ablauf zu durchlaufen. Sie zählen weiter im Nenner, tragen aber keine
> LLM-Aufrufe mehr bei. Die Verschiebung ist also **Folge der Regeländerung**, nicht ein
> Befund über Kosten oder Kontext.

> **Der Harness selbst wurde an einer Stelle korrigiert.** `bewerteGuardrail` in
> `evals/runners/policy.js` trug die Sanitisierschwelle als eigene `3` im Code — eine zweite
> Kopie derselben Zahl. Sie kommt jetzt aus `guardrailSchwellen` der Domäne. „Blockiert" wird
> weiterhin **strukturell** erkannt (der Lauf endet nach dem Guardrail), nicht über eine
> Schwelle.

> **Wann welche Zeile grün werden kann** — in der Ausführungsreihenfolge aus ADR-0024:
> 3.1–3.7 und 3.12 in **Phase 3** (Schicht A, Mock, deterministisch) · 3.8 in **Phase 5**
> mit der Domäne `immobilien` · 3.9, 3.10 und 3.11 in **Phase 4** mit der Judge-Maschine.
> Die Baseline-Spalte selbst bleibt davon unberührt; sie wird nie überschrieben.

### Dritte Messung — 2026-09-07 (Phase 5, zweite gemessene Domäne)

Anlass war wieder keine neue Regel, sondern eine **erweiterte Reichweite**: der Harness ist
domänenfrei geworden (ADR-0029) und fährt seither auch `immobilien`. Berichte:
`evals/reports/2026-09-07-schicht-a-report.json` und
`evals/reports/2026-09-07-schicht-a-immobilien.json`.

**`report` hat sich um keine Stelle bewegt.** Der Bericht ist Zeichen für Zeichen derselbe wie
der vom 2026-09-06, bis auf den Zeitstempel. Das war das Prüfkriterium des Umbaus: ein Refactor
der Messschicht, der die Messwerte verschiebt, macht unentscheidbar, ob sich das System oder
nur sein Maßstab geändert hat.

**`immobilien`, erste Messung** — 23 Aufgaben in acht Gruppen, Mock, zwei Durchgänge:

| Metrik | `report` (2026-09-07) | `immobilien` (erste Messung) | Nenner |
|---|---|---|---|
| 3.1 Approval-Enforcement | 100 % | ✅ **100 %** | 3 |
| 3.2 Unauthorized-Action | 0 % | ✅ **0 %** | **9** |
| 3.3 Loop-Termination | 100 % | ✅ **100 %** | 20 |
| 3.4 Routing-Determinismus | 100 % | ✅ **100 %** | 20 |
| 3.5 Guardrail P / R | 100 % / 100 % · TP 3 | 100 % / 100 % · **TP 3** · FP 0 · FN 0 | 3 |
| 3.6 Kosten je Lauf | Median 0,005172 USD | Median **0,005226 USD** | 20 |
| 3.12 Kontextwachstum | Median ×2,77 · Spitze 113 | Median **×1,00** · p90 ×1,00 · Spitze **281** | 12 |

23/23 Aufgaben vertragstreu, beide Durchgänge identisch — und identisch auch über die
Prozessgrenze hinweg (zwei getrennte Läufe, gleiche Werte).

> **Alle 23 Erwartungen stimmten im ersten Lauf.** Sie sind aus der Bremsenreihenfolge in
> `src/domains/immobilien/domain.js` abgeleitet worden, bevor der Harness sie das erste Mal
> ausgeführt hat. Dass keine nachgezogen werden musste, ist der eigentliche Befund: der
> Datensatz beschreibt die Regeln und nicht das beobachtete Verhalten.

> **Der Nenner von 3.2 ist größer als bei `report` (9 statt 3).** Ein genehmigter Lauf reiht
> **drei** Aktionen ein, eine je Portal. Die Zusage „keine Aktion ohne menschliche Freigabe"
> steht damit auf einem dreifach breiteren Nenner.

> **×1,00 bei 3.12 ist kein Messfehler, sondern eine Aussage über den Entwurf.** Jeder
> `listingWriter`-Aufruf bekommt denselben Objekt-Datensatz und kein Gesprächsprotokoll — der
> Prompt wächst nicht. In `report` wächst er (×2,77), weil Entwurf und Kritik mitwandern.
> Die Spitze liegt trotzdem höher (281 gegen 113 Token), weil ein Objekt-Datensatz als JSON
> länger ist als eine Berichtsaufgabe als Satz.

> **Was diese Zahlen NICHT sind: ein Wert für T8.** Im Mock-Modus baut `listingWriter` seinen
> Text aus dem Datensatz; der Vertrag ist per Konstruktion erfüllt, `contractChecker` läuft
> genau einmal und die Revisionsschleife (BREMSE6b) wird nie erreicht. Das Vertrags-**Tor**
> misst `tests/immobilien.test.js` gegen 12 fehlerhafte Inserate; den **Writer** misst erst
> Schicht B gegen ein echtes Modell (ADR-0019). Weitere Grenzen: `evals/README.md`.

## 6. Der Harness (Phase 3)

**Gebaut in Phase 3 (T3.3).** Die Ablage folgt der `kernel`/`domain`-Naht aus ADR-0018: die
Mechanik liegt im Kern, Vertrag und Etiketten in der Domäne. Was der Harness misst und wo er
blind ist, steht in `evals/README.md`.

> **Ein Teil steht schon: `evals/traces/`.** Seit T2.5 schreibt
> `src/kernel/observability/trace.js` je Lauf eine JSONL-Datei — `run_start`, eine Zeile je
> Knoten (Dauer, Log-Zeilen, Entscheidungsfelder, Längen der Textfelder), `run_pause` am
> Genehmigungstor, `run_resume` mit der menschlichen Entscheidung, ein einziges `run_end`.
> **Wer hier Metriken baut, liest Deltas, keinen akkumulierten State:** `revisionCount`
> steht als 1 in jeder Zeile, die Summe ist der Stand. Der Volltext der Entwürfe steht
> bewusst nicht darin; braucht Schicht B ihn, ist das eine bewusste Erweiterung.

```
evals/
├─ README.md                        was gemessen wird — und was nicht
├─ runners/
│  ├─ policy.js                     Schicht A, Mock — domänenfrei (ADR-0029)
│  └─ quality.js                    Schicht B, echtes Modell
├─ metrics/                         Zähler/Nenner aus §3, an einer einzigen Stelle
├─ domains/
│  ├─ index.js                      welche Domänen gemessen werden (explizite Liste)
│  ├─ report/
│  │  ├─ adapter.js                 die sechs Felder, die der Runner braucht
│  │  ├─ golden/tasks.json          §4.1 — 20 Aufgaben
│  │  ├─ quality/labels.json        §4.2 — 30 Etiketten
│  │  ├─ quality/broken.json        §4.2 — 9 Bruchfälle
│  │  └─ judge.md                   Rubrik für 3.9
│  └─ immobilien/
│     ├─ adapter.js                 dasselbe Formular, andere Domäne
│     └─ golden/
│        ├─ tasks.json              §4.1 — 23 Aufgaben
│        ├─ portfolio.json          10 Objekte aus der Kundenerkundung
│        └─ negative-listings.json  12 fehlerhafte Inserate für das Vertrags-Tor
├─ traces/                          JSONL je Lauf (gitignore; samples/ committet)
└─ reports/                         datiert und versioniert, je Domäne eine Datei
```

Der Runner nennt **keine Domäne, keinen Agenten und keinen Aktionstyp**. Alles Domänenwissen
steht im Adapter (ADR-0029); eine dritte gemessene Domäne kostet eine Datei und einen Eintrag
in `domains/index.js` — null Zeilen in `runners/policy.js`.

`evals/domains/report/` ist bei einer einzigen Domäne ein Verzeichnis zu viel — bewusst so
(ADR-0018). Ein Datensatz, der später umzieht, verliert den Vergleich zu seiner Baseline.
In Phase 5 tritt `evals/domains/immobilien/` **daneben**, nicht an seine Stelle: am
Berichtsdatensatz hängt die Baseline der Schicht A.

Die Judge-Teile dieses Baums — `quality/labels.json`, `quality/broken.json` und `judge.md` —
entstehen erst in **Phase 4** (ADR-0024). Was in Phase 3 gebaut wird, ist `runners/policy.js`
samt `metrics/` und dem goldenen Datensatz.

Drei Anforderungen an den Bau:

**Determinismus ist beweispflichtig.** `npm run evals` muss zweimal hintereinander dasselbe
Ergebnis liefern. Tut es das nicht, misst der Harness Rauschen. Für Schicht B gilt das nicht —
dort wird stattdessen die Streuung über drei Läufe berichtet.

**Traces werden geschrieben.** Je Lauf eine JSONL-Datei mit allen `log[]`-Zeilen und
Zustandsübergängen. Damit ist das Prinzip „Trace vor Evaluation" erfüllt, ohne eine Datenbank
einzuführen — und ein auffälliger Wert lässt sich bis zur Ursache zurückverfolgen, statt nur
als Zahl dazustehen.

**Berichtet wird die Verteilung, nicht die Note.** Ein Bericht, der „3.9 = 0,82" sagt, ist
wertlos für die nächste Entscheidung. Gefragt ist, welche Fehlerarten wie häufig auftreten —
erst diese Verteilung sagt, woran als Nächstes zu arbeiten ist.

## 7. Die Evaluationen selbst evaluieren

Ein Rahmen, der immer grün meldet, misst nichts. Drei Gegenproben gehören zur Praxis:

**Mutationsprobe.** Eine Korrektur aus Phase 2 zurücknehmen — die zugehörige Metrik **muss**
rot werden. Wird sie es nicht, prüft die Metrik nicht, was sie zu prüfen vorgibt.
Seit T3.1 gibt es davon eine ausführbare Form: `tests/workflow.test.js` schlägt fehl, sobald
die Kante `human_approval → publisher` wieder unbedingt wird, und `tests/orchestrator.test.js`
schlägt fehl, sobald 6a und 6b wieder zusammenfallen. Der Harness erbt diese Probe, er
erfindet sie nicht neu.

**Nenner-Probe.** Wenn Approval-Enforcement 100 % meldet: wie groß ist der Nenner? Ein Lauf,
der nie eine Aktion einreiht, erfüllt die Metrik trivial. Hundert Prozent aus einem Nenner
von null ist keine Aussage.

**Judge-Probe.** 3.11 ist keine Nebenmetrik, sondern die Bedingung, unter der 3.9 überhaupt
berichtet werden darf. Fällt die Übereinstimmung unter 80 %, wird nicht das menschliche Etikett
korrigiert, sondern die Rubrik in `judge.md` — oder der Wert bleibt weg.

## 8. Ausführen

```bash
npm run evals                  # ✅ Schicht A, alle Domänen, Mock, kostenlos, in CI bei jedem Push
npm run evals -- immobilien    # ✅ nur eine Domäne — für die Entwicklung, nicht für CI
npm run evals:quality                    # Schicht B, ECHTES Modell, kostet Geld — eigener Lauf
npm run evals:quality -- --dry-run       # zeigt den Plan, macht KEINEN Modellaufruf
npm run evals:quality -- --objekte 1     # Rauchprobe: 3 Aufrufe, wenige Cent
```

Schicht B läuft **nicht** in CI und **nicht** im Mock-Modus: ohne `ANTHROPIC_API_KEY` bricht
sie mit einer Erklärung ab, statt eine Zahl zu erfinden. Sie hat eine Ausgabengrenze
(`--max-usd`, Standard 1,00) und schreibt auch bei einem Abbruch den Bericht über das, was
bereits gemessen wurde (ADR-0030).

Der Exit-Code ist gemeinsam: eine grüne Domäne rettet keine rote. In CI läuft immer der volle
Satz — sonst bliebe eine Domäne ungemessen, während der Befehl grün meldet.

Die Trennung ist Absicht: der Prüfaufwand wird am Risiko kalibriert, nicht am Gefühl. Schicht A
schützt die Zusagen, die nie brechen dürfen, und ist deshalb billig genug für jeden Push.
Schicht B misst Qualität, kostet Geld und läuft seltener.

Bis dahin prüft der Skill **`projekt-doktor`** den Zustand der Phasen-Gates: Prüfung 9
entspricht T1 (`npm run demo`), Prüfung 10 T3 (Tests), Prüfung 11 T4 (Evaluationen).
Baseline-bedingtes Rot markiert er getrennt von echten Ausfällen.
