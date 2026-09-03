# DECISIONS — Architecture Decision Log

> Jede Entscheidung mit Kontext, Wahl und Konsequenz. Eine Entscheidung wird hier
> festgehalten, sobald ihre Rücknahme teuer wäre — nicht erst, wenn sie sich bewährt hat.
>
> Reift eine Regel aus `.gehirn/regeln.md` zu einer Architekturentscheidung, wandert sie
> hierher und wird dort auf eine Zeile gekürzt.

**Stand:** Phase 2 · **Zuletzt aktualisiert:** 2026-09-03 · **25 Einträge**

---

## ADR-0001 — Hub-and-Spoke statt Kettenlogik

**Kontext.** Sobald es mehr als einen Agenten gibt, stellt sich die Frage „wer ist als
Nächstes dran?". Die Antwort kann in den Kanten liegen (jeder Agent kennt seinen Nachfolger)
oder in einem zentralen Knoten.

**Entscheidung.** Alle Agenten kehren zum `orchestrator` zurück. Kanten sagen nur
„geh dahin, was `state.nextAgent` sagt".

**Konsequenz.** Ein zusätzlicher Knotendurchlauf pro Schritt, also mehr Latenz. Dafür ist die
Frage „warum ging es dorthin?" an einer einzigen Stelle beantwortbar. Für eine Musterbibliothek
ist die Prüfbarkeit das Produkt — ein Routing, das man nicht an einer Stelle lesen kann, taugt
nicht als Vorlage.

## ADR-0002 — Deterministisches Routing vor dem LLM, dreischichtig

**Kontext.** Ein LLM kann jeden Routing-Schritt entscheiden. Das kostet bei jedem Schritt
Token und ist bei jedem Schritt unsicher.

**Entscheidung.** Drei Schichten: geordnete Code-Regeln („BREMSEN") zuerst, das LLM nur bei
Unklarheit, danach eine Validierung der Modellantwort gegen `VALID_AGENTS`.

**Konsequenz.** Der Großteil der Läufe kostet null Routing-Token. Die Regeln sind starr —
ein unvorhergesehener Zustand landet beim LLM, und dessen Antwort ist nicht garantiert gültig,
weshalb Schicht 3 existiert. Leitidee: das LLM ist Geschworener, nicht Richter.

## ADR-0003 — Der Guardrail arbeitet ohne LLM

**Kontext.** Eingaben müssen auf Prompt-Injection geprüft werden. Naheliegend wäre, ein LLM
zu fragen: „ist dieser Text gefährlich?"

**Entscheidung.** Reine Regex-Bewertung, kein Modellaufruf.

**Konsequenz.** Die Prüfung selbst ist nicht injizierbar — wer den Guardrail täuschen will,
müsste die Regex täuschen, nicht ein Sprachmodell. Der Preis: Regex erkennt nur, was jemand
vorher als Muster formuliert hat. Ein zweiter Vorteil fällt ab: der Guardrail kann als erster
Knoten laufen, ohne Kosten zu verursachen — deshalb sitzt dort auch der Budget-Kill-Switch.

## ADR-0004 — Aktions-Isolation: Agenten rufen keine externen APIs

**Kontext.** Der `publisher` müsste eigentlich Telegram, E-Mail oder einen Webhook aufrufen.

**Entscheidung.** Er schreibt ausschließlich in eine Queue. Ein separater Worker validiert
erneut und führt aus. Zwei Tore: Whitelist beim Einreihen, Payload-Schema beim Ausführen.

**Konsequenz.** Ein gekaperter oder halluzinierender Agent kann weder Daten abfließen lassen
noch spammen — die Angriffsfläche schrumpft von „alles, was das Netz erlaubt" auf drei
validierte Formen. Der Preis ist Indirektion: Ausführung ist nicht mehr synchron zum Agenten,
Fehler tauchen zeitversetzt auf.

## ADR-0005 — HITL über `interruptBefore` und einen Checkpointer

**Kontext.** Der Mensch muss vor einer nach außen wirkenden Aktion entscheiden. Zwischen
Anhalten und Fortsetzen liegen zwei getrennte HTTP-Anfragen.

**Entscheidung.** `interruptBefore: ["human_approval"]`. Der Zustand liegt im Checkpointer;
die zweite Anfrage adressiert ihn über **dieselbe `thread_id`**.

**Konsequenz.** Der Ablauf ist eine Zustandsmaschine zwischen zwei Anfragen. Alles hängt an
der `thread_id`: geht sie verloren, ist der Workflow nicht mehr adressierbar — er läuft nicht
falsch weiter, er ist unerreichbar.

## ADR-0006 — `MemorySaver` statt persistentem Checkpointer (v1)

**Kontext.** Ein persistenter Checkpointer (MongoDB) würde HITL-Läufe über Neustarts retten,
zieht aber eine Datenbank in ein Repo, das ohne Infrastruktur laufen soll.

**Entscheidung.** Für v1 bleibt es beim `MemorySaver` im Arbeitsspeicher.

**Konsequenz.** `git clone && npm install && npm run demo` genügt — kein Docker, keine DB.
Der Preis ist hart: **bei einem Neustart gehen auf Genehmigung wartende Workflows verloren.**
Genau deshalb heißt das Repo „production-patterned" und nicht „production-ready" (ADR-0009).
Der Weg zur Ablösung steht in `EXTEND.md` §3.

## ADR-0007 — Reducer-Zuordnung als fachliche Aussage

**Kontext.** Jedes State-Feld braucht eine Regel, wie ein Delta einfließt. Die Wahl ist nicht
technisch, sondern semantisch.

**Entscheidung.** Drei Reducer: `keepIfFilled` für Produktionsdaten (ein leeres Schreiben darf
eine gute Vorstufe nicht zerstören), `lastWins` für Entscheidungsfelder, `sum` für Zähler.

**Konsequenz.** Die Zuordnung ist selbsterklärend — bis auf einen Fehler: `criticFeedback`
liegt auf `keepIfFilled`, ist aber ein Entscheidungsfeld. Der Critic setzt es nach einer
Freigabe bewusst auf `""`, der Reducer schluckt das, veraltete Kritik bleibt stehen. Sichtbar
wird das erst, wenn die Revisionsschleife wieder läuft (Phase 2). Korrektur: `lastWins`.

## ADR-0008 — Der Mock-Modus ist Fundament, nicht Bequemlichkeit

**Kontext.** Ohne API-Schlüssel müsste das System entweder nicht laufen oder etwas vortäuschen.

**Entscheidung.** Fehlt `ANTHROPIC_API_KEY`, liefert der LLM-Adapter deterministische
Fake-Antworten; der komplette Graph läuft durch.

**Konsequenz.** Tests und Evaluationen sind kostenlos, reproduzierbar und CI-tauglich — das ist
die Voraussetzung für die gesamte Messstrategie. Der Preis muss offen benannt werden: gemessen
werden **Routing- und Richtlinienkorrektheit, nicht LLM-Ausgabequalität** (`EVALS.md` §2).

**Nachtrag (ADR-0019):** Das gilt für Schicht A. Die Ausgabequalität wird seit ADR-0019
in Schicht B gegen ein echtes Modell gemessen — außerhalb des Mock-Modus und außerhalb CI.

## ADR-0009 — „production-patterned" statt „production-ready"

**Kontext.** Die ursprüngliche Beschreibung nannte das Repo „production-ready". Der
Artefakt-Speicher ist eine `Map`, der Checkpointer liegt im RAM, Executor sind simuliert, es
gibt einen Tenant.

**Entscheidung.** Das Repo bezeichnet sich als **production-patterned**: die Muster sind
produktionsreif, dieses Repo ist es nicht.

**Konsequenz.** Eine Behauptung weniger, die bei der ersten technischen Prüfung zurückfällt.
Für einen öffentlichen Arbeitsnachweis ist eine belegbare kleine Aussage mehr wert als eine
große, die nicht hält.

## ADR-0010 — Die Dateigrenze zählt nur `src/`

**Kontext.** Die Projektidee nennt „höchstens 20 Dateien", listet in ihrem eigenen Zielbaum
aber rund 35. Die Rechnung ging nie auf.

**Entscheidung.** Die Grenze gilt für Quelldateien unter `src/` (aktuell 19). Tests,
Evaluationen und Dokumente zählen nicht mit.

**Konsequenz.** Die Grenze bleibt eine echte Beschränkung für die Kernkomplexität, ohne
Tests zu verdrängen. Wären Tests mitgezählt, hätte die Grenze das Projekt gegen sein eigenes
Ziel gedrängt.

**Nachtrag (ADR-0021):** Die Grenze gilt inzwischen für `src/kernel/`, nicht mehr für `src/`.

## ADR-0011 — Das Gehirn-System v2.1.0 wurde angepasst, nicht übernommen

**Kontext.** Ein aus einem anderen Projekt übernommenes „Gehirn" (38 Dateien) sollte in dieses
Repo integriert werden: Companion-Gedächtnis, ein `daily`→`knowledge`-Compiler, ein
Obsidian-Vault mit Emoji-Ordnern, zwei Prüf-Skills.

**Entscheidung.** 9 Dateien angepasst, 28 begründet nicht übernommen: vier Python-Skripte und
drei Hooks (leichte Automatisierung, ADR-0013), fünf `.ps1`-Varianten (vertagt), sieben
Vault-Ordner und `Journal.md` (Projektfokus, ADR-0012), `gecmis-import` (außerhalb des
Umfangs), fünf Compiler-Artefakte (ohne Compiler ohne Ein- und Ausgabe).

**Konsequenz.** Das Gedächtnis dient dem Projekt, nicht einem Lebens-OS. Die Quellversion ist
**v2.1.0** — festgehalten, weil die Datei `.beyin-version` nicht übernommen wurde und ohne
diesen Eintrag niemand mehr wüsste, wovon abgezweigt wurde.

## ADR-0012 — `.gehirn/` hält Kontinuität, die Repo-Dokumente halten die Wahrheit

**Kontext.** Mit `DECISIONS.md`, `.gehirn/regeln.md` und einem Wissens-Compiler hätte es drei
Gedächtnisse gegeben, die auseinanderdriften können.

**Entscheidung.** Eine Autoritätskette mit einem Besitzer je Information. Dauerhaftes Wissen
lebt in den Repo-Dokumenten; `.gehirn/` hält nur Kontinuität und noch nicht entschiedene
Themen. Reift ein Thema, wandert es und die Spur wird gekürzt.

**Konsequenz.** `.gehirn/` ist Arbeitsspeicher, kein Archiv, und muss aktiv kuratiert werden.
Dafür gibt es keine zwei Wahrheiten über dieselbe Sache.

## ADR-0013 — Leichte Automatisierung: ein Hook, node statt python3

**Kontext.** Das Ausgangssystem hatte vier Hooks und einen Python-Compiler, der bei jedem
Sitzungsende Claude aufrief.

**Entscheidung.** Nur `SessionStart`. Das Gedächtnis schreibt der Agent von Hand. Das
JSON-Escaping läuft über `node` statt `python3`.

**Konsequenz.** Der Hook fügt **keine neue Abhängigkeit** hinzu — node ist als Node-Projekt
ohnehin Pflicht. Keine automatischen Modellaufrufe, keine Kosten, weniger stille Ausfälle.
Der Preis: Wird das Gedächtnisprotokoll nicht befolgt, altert das Gedächtnis, und nichts
erinnert daran. Deshalb Prüfung 7 im `projekt-doktor`.

## ADR-0014 — Die `kernel`/`domain`-Trennung wird vertagt

**Kontext.** Das Repo behauptet, domänenunabhängig zu sein, hat die Domäne aber über acht
Dateien verteilt (Prompts, Bremsenreihenfolge, State-Feldnamen, Aktionstypen). Eine Trennung
in wiederverwendbaren Kern und austauschbare Domäne würde die Behauptung erst prüfbar machen.

**Entscheidung.** Vertagt bis nach Phase 3.

**Konsequenz.** Die Behauptung „domänenunabhängig" bleibt vorerst ungeprüft — das ist offen
zu sagen. Dafür wird das Refactoring erst dann gemacht, wenn Tests als Sicherheitsnetz
existieren; ein Umbau ohne Netz auf einem System mit drei blockierenden Defekten wäre
leichtsinnig. Zur Prüfung genügt später eine zweite, minimale Domäne in `tests/fixtures/`.

**Nachtrag (ADR-0018):** Die Naht selbst wird inzwischen vorab festgelegt; vertagt bleibt
allein der Umbau von `src/`.

**Nachtrag (ADR-0023):** Der Umzug findet innerhalb von Phase 3 statt, nicht danach.

## ADR-0015 — Die Defekte aus Phase 0 werden gemessen, nicht sofort behoben

**Kontext.** Eine Prüfung fand 13 Befunde, drei blockierend. Der Reflex wäre, sie sofort zu
beheben.

**Entscheidung.** Sie bleiben bis Phase 2 offen und werden als **Baseline** in `PRODUCT.md`
§6.1 festgehalten, sichtbar auch im README.

**Konsequenz.** Das Repo sieht zunächst schlechter aus als nötig. Dafür wird jede spätere
Verbesserung belegbar — ohne Referenzpunkt ist „ich habe es verbessert" eine Behauptung.
Für einen Arbeitsnachweis ist der dokumentierte Übergang von Rot zu Grün wertvoller als eine
makellose Momentaufnahme.

## ADR-0016 — Das Repo ist deutsch, das Gespräch türkisch

**Kontext.** Dokumente waren teils deutsch, Code-Kommentare und Logs türkisch, das Gespräch
türkisch. Drei Sprachen in einem Repo.

**Entscheidung.** Alles, was ins Repo geht, ist deutsch — Dokumente, Kommentare, Log-Ausgaben,
Gedächtnisdateien. Das Gespräch bleibt türkisch. Verzeichnis- und Skill-Namen sind deutsch
(`.gehirn/`, `projekt-doktor`); die Dateinamen der Wurzeldokumente bleiben englisch
(`PRODUCT.md`, `EXTEND.md` …), weil das die gängige Konvention ist und Querverweise nicht bricht.

**Konsequenz.** 19 Quelldateien wurden übersetzt (219 Kommentarzeilen, 26 Log-Ausgaben).
Dafür wurden zwei verbindliche Regeln bewusst übergangen („`src/` bis Phase 2 nicht anfassen").
Die Ausnahme ist vertretbar, weil die Übersetzung **kein Verhalten ändert** — verifiziert:
derselbe `GraphRecursionError`, Baseline erhalten. Zeitargument: Log-Texte vor den Tests zu
übersetzen spart, sie in Phase 3 zweimal zu schreiben.

**Nachtrag:** `CLAUDE-CODE-BRIEFING.md` ist eine ausdrückliche Ausnahme und bleibt türkisch —
sie stellt das Projekt der Nutzerin oder dem Nutzer dar, nicht einem Agenten.

**Zweiter Nachtrag (2026-09-02):** `documentation.md` ist die zweite und vorerst letzte
Ausnahme. Das Kriterium ist damit ausgesprochen: **türkisch ist, was das Projekt einem
Menschen erklärt; deutsch ist alles, was ein Agent oder ein Beitragender als Vertrag liest.**
Die beiden türkischen Dateien teilen sich diese Rolle nicht doppelt — das Briefing trägt
Zweck, Leitsätze und Stand, `documentation.md` trägt den Weg: wie das Repo entstand, welche
Datei welche Aufgabe hat und wie jemand ein eigenes Projekt so beginnt. Der Preis: zwei
Dateien in einer Fremdsprache des Repos, die bei jeder Statusänderung mitgepflegt werden
müssen. Vertretbar, weil beide auf die Vertragsdokumente verweisen statt Zahlen zu
wiederholen.

## ADR-0017 — `kern.md` wird injiziert; `CLAUDE.md` besitzt die Autoritätskette allein

**Kontext.** Eine Messung zeigte: der Hook injizierte 56 % des Gedächtnisses, `kern.md`
jedoch zu **0 %** — obwohl `CLAUDE.md` es als Punkt 1 der Ladereihenfolge führt. Zusätzlich
enthielten `kern.md` und `CLAUDE.md` beide eine „Autoritätskette".

**Entscheidung.** `kern.md` wird vollständig injiziert und steht an erster Stelle (Identität →
Kontext → Arbeitsliste → Regeln). Die Autoritätskette wurde aus `kern.md` entfernt.

**Konsequenz.** Ein Anker, dessen Laden davon abhing, dass der Agent sich daran erinnert, ist
jetzt garantiert geladen. Budget: 3000 + 4000 + 2000 + 4000 = 13.000 unter der Obergrenze von
16.000, die gestaffelte Kürzung bleibt überflüssig. Wer ein Limit anhebt, muss diese Summe
nachrechnen. Der Fund selbst belegt ADR-0012: zwei Kopien derselben Information driften — hier
wurden sie es, bevor jemand sie las.

## ADR-0018 — Die `kernel`/`domain`-Naht wird jetzt festgelegt, der Umbau bleibt vertagt

**Kontext.** ADR-0014 hat die Trennung vertagt, mit gutem Grund: ein Umbau ohne Testnetz auf
einem System mit drei blockierenden Defekten wäre leichtsinnig. Seitdem ist eine Abhängigkeit
dazugekommen, die es damals nicht gab — das Evaluations-Harness. Die Qualitätsschicht der
Evaluation braucht eine Rubrik und einen handetikettierten Datensatz, und beides gehört der
Domäne, nicht dem Kern. Wird die Naht nicht vor dem Schreiben benannt, wächst die Domäne
weiter in den Kern hinein: bisher über acht Dateien, nach dem Harness über mehr.

**Entscheidung.** Die Naht wird jetzt als Vertrag festgelegt; der Umbau von `src/` bleibt bis
nach Phase 3 vertagt. Der **Kern trägt Mechanik**: Graph-Topologie, Routing-Verfahren, HITL-Tor,
Reducer-Mechanik, Sicherheitsschichten, LLM-Adapter, Trace. Die **Domäne trägt Bedeutung**:
Agenten-Prompts, konkrete Bremsenreihenfolge, fachliche State-Felder, erlaubte Aktionstypen
samt Payload-Schema, Eval-Rubrik und etikettierter Datensatz. Alles ab heute Neugeschriebene
wird bereits entlang dieser Naht abgelegt — `evals/` bekommt ein `domains/`-Verzeichnis, der
Trace liegt im Kern. Erste und vorerst einzige Domäne: `report`.

**Konsequenz.** Die Behauptung „domänenunabhängig" wird messbar: eine zweite, minimale Domäne
hinzuzufügen darf **null Zeilen** in Kerndateien ändern — die Registrierung der Domäne zählt
nicht mit, sie ist Konfiguration. Fällt die Messung anders aus, wird die Behauptung in
`PRODUCT.md` abgeschwächt, nicht die Messung. Der Preis: ein Vertrag vor dem Code kann sich
beim Umbau als falsch geschnitten erweisen — dann wird er korrigiert, nicht stillschweigend
gedehnt. Zweiter Preis: `evals/domains/report/` ist bei einer einzigen Domäne ein Verzeichnis
zu viel. Das ist bewusst. Ein Datensatz, der später umzieht, verliert den Vergleich zu seiner
Baseline, und die Vergleichbarkeit ist hier das Produkt.

## ADR-0019 — Qualitätsevaluation wird v1-Ziel, aber als Vertrag statt als Urteil

**Kontext.** `EVALS.md` §2 erklärte die Qualitätsmessung zum Nicht-Ziel für v1, mit gutem
Grund: „ist der Bericht gut?" ist im Mock-Modus nicht beantwortbar und als Frage zu vage,
um eine Metrik zu tragen. Zugleich ist genau diese Schleife das, was die Kompetenzkarte als
unterscheidendes Merkmal benennt. Ein Repo, das Messdisziplin behauptet und die
unterscheidendste Messung auslässt, belegt seine Behauptung nur zur Hälfte.

**Entscheidung.** Die Qualitätsevaluation wird v1-Ziel — aber nicht als Urteil, sondern als
**Ausgabevertrag**. Der `writer` schuldet 3–5 belegte Punkte, jeder Beleg ein wörtliches
Zitat aus `state.research`. Damit ist der Großteil der Prüfung deterministisch; ein Judge
bewertet nur, ob die Aussage aus ihrem Beleg folgt, und wird selbst gegen 30 menschliche
Etiketten gemessen. Unter 80 % Übereinstimmung wird sein Wert nicht berichtet.

**Konsequenz.** Der Vertrag verengt den `writer`: er zitiert, statt frei zu formulieren. Das
ist der Preis für Messbarkeit und wird offen genannt. Die Baseline geht rot — der heutige
Prompt erfüllt den Vertrag nicht, `writer.js` bleibt vorerst unangetastet (ADR-0015). Zweite
Folge: die Evaluation zerfällt in zwei Läufe mit verschiedenen Kosten, was `npm run evals`
und `npm run evals:quality` trennt und in CI zwei Jobs erzwingt.

## ADR-0020 — Erst der Arbeitsnachweis, dann der Produktkern

**Kontext.** Offen war, wofür dieses Repo am Ende dienen soll: als öffentlicher
Arbeitsnachweis oder als Kern für eigene vertikale Produkte. Die Antwort entscheidet, ob je
eine echte Domäne aufgenommen wird — und damit, ob das Prüfkriterium aus ADR-0018 jemals
ausgeführt wird oder eine Behauptung auf dem Papier bleibt.

**Entscheidung.** Beides, in dieser Reihenfolge. Phase 2–4 liefern den Arbeitsnachweis: den
belegten Übergang von Rot zu Grün. Phase 5 nimmt **eine echte Domäne** auf und macht das
Repo zum Kern eigener Produkte.

**Konsequenz.** Die zweite Domäne ist kein offener Punkt mehr, sondern geplant — und sie
erledigt drei Dinge auf einmal: sie führt das Prüfkriterium aus ADR-0018 aus (null Zeilen in
Kerndateien), sie liefert den Geschäftskontext, der Achse 04 bisher fehlt, und sie erzeugt
erstmals die Mehr-Agenten-Kontextlast, deren Messung in Phase 3 vorbereitet wird
(`EVALS.md` §3.12). Der Preis: Phase 5 wächst. Sie hieß „Härten" und trägt jetzt zusätzlich
eine Domäne. Das ist vertretbar, weil ohne sie zwei Behauptungen dieses Repos unbelegt
blieben.

## ADR-0021 — Die Dateigrenze gilt für `src/kernel/`, nicht für `src/`

**Kontext.** ADR-0010 begrenzte `src/` auf 20 Dateien (aktuell 19). Die Zielstruktur aus
ADR-0023 trennt Kern, Domänen und Adapter und braucht rund 30 Dateien. Die Grenze in ihrer
alten Form würde die Struktur verhindern, die sie eigentlich schützen soll.

**Entscheidung.** Die Grenze gilt ab sofort für **`src/kernel/` (≤ 20 Dateien)**. Domänen,
Adapter, `bin/`, Tests und Evaluationen zählen nicht mit.

**Konsequenz.** Der ursprüngliche Zweck bleibt erhalten und wird sogar schärfer: begrenzt
wird die **Kernkomplexität** — genau das, was ADR-0010 wollte. Eine wachsende Domänenzahl
darf den Kern nicht aufblähen; wächst er trotzdem, ist das ein Signal, dass Domänenwissen
hineingesickert ist, und damit zugleich eine Warnung für das Prüfkriterium aus ADR-0018.
Der Kern zählt heute 16 Dateien, die Grenze bleibt also eine echte Beschränkung.

## ADR-0022 — MCP ist ein Adapter: erst Server, dann Client — und nie ein Genehmigungswerkzeug

**Kontext.** MCP war weder im Umfang noch unter den Nicht-Zielen. Zwei Bauformen sind
möglich: das Repo **bietet** seine Fähigkeiten als MCP-Server an, oder Agenten **nutzen**
externe MCP-Server als Werkzeuge.

**Entscheidung.** Beide, in dieser Reihenfolge. **Server in Phase 4** — als reiner Adapter
über demselben Kern, den auch HTTP benutzt. **Client in Phase 5**, zusammen mit Grounding.
Werkzeuge des Servers: `run_workflow`, `get_status`, `list_queue`. **Die Genehmigung wird
niemals als MCP-Werkzeug angeboten.**

**Konsequenz.** Die Reihenfolge folgt der Messdisziplin: ein Client bringt externe
Nichtdeterminiertheit genau dann ins System, wenn die Evaluations-Baseline entsteht — er
würde beschädigen, was gerade gemessen wird. Der Server dagegen berührt den Kern nicht und
ist damit zugleich der **Beweis, dass die Adapternaht trägt**: zwei Kanäle, ein Kern.
Die Genehmigungsregel ist nicht verhandelbar — böte man `approve` als Werkzeug an, könnte
der Agent, der den Lauf startet, seine eigene Aktion freigeben. Damit wäre die zentrale
Zusage dieses Repos in dem Moment gebrochen, in dem sie am sichtbarsten wäre.
Neue Abhängigkeit in Phase 4: `@modelcontextprotocol/sdk` (vorab freigegeben).

## ADR-0023 — Zielstruktur Kern / Domänen / Adapter; der Umzug findet in Phase 3 statt

**Kontext.** ADR-0018 legte die Naht zwischen Mechanik und Bedeutung als Vertrag fest, ließ
aber offen, wie der Baum konkret aussieht und wann umgezogen wird — ADR-0014 sagte „nach
Phase 3". Ohne konkreten Zielbaum landet jede neue Datei an einer vorläufigen Stelle und
muss später doch bewegt werden.

**Entscheidung.** Drei Ringe: **`kernel/`** trägt Mechanik (Graph, Routing-Verfahren, State-
Reducer, Sicherheitsmechanik, Trace, LLM-Adapter, Registry), **`domains/`** trägt Bedeutung
(Agenten, Prompts, Bremsenreihenfolge, Aktionstypen, Ausgabevertrag), **`adapters/`** trägt
den Kontakt zur Außenwelt (HTTP, später MCP). Der Zielbaum steht in `ARCHITECTURE.md` §6.
Der **Umzug findet innerhalb von Phase 3 statt**, nicht danach — sobald die Tests dieser
Phase stehen und bevor die Evaluations-Baseline auf der alten Struktur festgeschrieben wird.
**Jede ab heute neu geschriebene Datei** wird sofort an ihrem Zielort angelegt.

**Konsequenz.** Die Trennlinie ist an drei Stellen fein und muss beim Umzug bewusst gezogen
werden: die Routing-**Mechanik** gehört in den Kern, die **Reihenfolge der Bremsen** in die
Domäne; die Regex-**Engine** in den Kern, die **Muster** in die Domäne; die Queue-**Mechanik**
in den Kern, die **Whitelist** in die Domäne. Wer das verwechselt, hat den Kern wieder
domänenabhängig gemacht — messbar am Kriterium aus ADR-0018.

Der Umzug bekommt ein eigenes Prüfkriterium statt einer eigenen Phase: **dieselben Tests
liefern vor und nach dem Umzug dasselbe Ergebnis.** Damit ist er eine Refaktorierung im
Wortsinn und keine Änderung, die sich als Aufräumen tarnt.

## ADR-0024 — Das Produkt wird vor der Veröffentlichung gebaut

**Kontext.** ADR-0020 setzte die Reihenfolge: erst der Arbeitsnachweis (Phase 2–4), dann der
Produktkern (Phase 5). Inzwischen gibt es in der Immobiliendomäne einen realen
Gesprächspartner mit einem einzigen Portfolio — ein echter Geschäftskontext, den es beim
Fassen von ADR-0020 nicht gab. Damit wird eine Lücke des alten Plans sichtbar: **zwei
Behauptungen dieses Repos lassen sich ohne Kunden nicht belegen.** Das Prüfkriterium aus
ADR-0018 verlangt eine zweite echte Domäne, und Achse 04 verlangt einen echten
Geschäftskontext. Eine Fallstudie vor der Domäne wäre eine Fallstudie ohne echte Zahlen.

**Entscheidung.** Die Phasennummern bleiben, **die Ausführungsreihenfolge ändert sich:
2 → 3 → 5 → 4 → 6.** Phase 5 (Produkt) läuft vor Phase 4 (Veröffentlichung). Vier Bewegungen
begleiten den Tausch: die Judge-Maschine der Schicht B (§3.9, §3.10, §3.11 samt der 30
Handetiketten) wandert von Phase 3 nach Phase 4 · T8 wandert von Phase 3 nach Phase 5 und
wechselt den Eigentümer von `report` nach `immobilien` · Mehrmandantenfähigkeit und
Kontextstrategie wandern aus Phase 5 in die **neue Phase 6 (Skalieren)** · das minimale CI
wandert von Phase 4 nach Phase 3, weil es die gesamte Phase 5 absichert. Dazu eine fünfte,
vom Tausch erzwungene Bewegung: der **MCP-Client wandert von Phase 5 nach Phase 6**, damit
die Reihenfolge aus ADR-0022 — erst Server, dann Client — auch in der Ausführung gilt.
**Trace, Tests und Schicht A werden nicht verschoben** — die Messdisziplin bleibt vor dem
Produkt.

**Konsequenz.** Umnummeriert wird nicht: im Repo stehen **215 Phasenverweise in 15 Dateien**
— gezählt, nicht geschätzt. Eine Umnummerierung bräche die Metriknummern in `EVALS.md` §3,
die Querverweise zwischen den ADRs und die Gate-Bindungen des Skills `projekt-doktor`
(Prüfung 9 → T1, 10 → T3, 11 → T4). Der Gewinn wäre kosmetisch, der Preis real; so bleibt
jeder bestehende Verweis richtig. Der Preis der Entscheidung selbst: der öffentliche
Arbeitsnachweis kommt später, und die Qualitätszahlen der Schicht B fehlen bis Phase 4.
Dafür wird die Fallstudie mit echten Zahlen geschrieben. Phase 2 bekommt dadurch eine
Auflage: **die Zeit-Baseline des manuellen Prozesses muss erhoben werden, bevor das System
steht.** Wird sie danach erhoben, ist T13 („wir haben beschleunigt") keine Messung, sondern
eine Behauptung — dieselbe Logik wie ADR-0015.

## ADR-0025 — Ein Mandant, aber `tenantId` von Anfang an im Schema

**Kontext.** Mit ADR-0024 rückt die Persistenz in Phase 5 und die Mehrmandantenfähigkeit in
Phase 6. Offen war damit, ob die ersten persistenten Schemata bereits eine Mandantenidentität
tragen oder ob sie nachgerüstet wird, sobald ein zweiter Kunde kommt.

**Entscheidung.** Mehrmandantenfähigkeit bleibt außerhalb des Umfangs — kein SSO, kein
Onboarding, keine Mandantenverwaltung, ein einziger Mandant. Aber **`tenantId` steht vom
ersten persistenten Schema an darin, mit genau einem festen Wert, und wird in jeder Abfrage
gefiltert.** Eine Abfrage ohne Mandantenfilter gilt ab sofort als Defekt, auch solange es nur
einen Mandanten gibt.

**Konsequenz.** `EXTEND.md` §4 nennt die gemischte Mandantenidentität eine der teuersten
technischen Schulden überhaupt, weil sie jede spätere Abfrage berührt. Heute kostet die
Versicherung fast nichts: ein Feld und ein Filter. Später kostet sie jede Abfrage im System.
Damit bekommt auch Phase 6 ihr Prüfkriterium: Mehrmandantenfähigkeit heißt dann **die Werte
vervielfachen sich, die Abfragen bleiben unverändert.** Muss dort doch eine Abfrage angefasst
werden, wurde diese Entscheidung nicht eingehalten.
