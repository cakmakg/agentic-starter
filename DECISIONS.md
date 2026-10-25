# DECISIONS — Architecture Decision Log

> Jede Entscheidung mit Kontext, Wahl und Konsequenz. Eine Entscheidung wird hier
> festgehalten, sobald ihre Rücknahme teuer wäre — nicht erst, wenn sie sich bewährt hat.
>
> Reift eine Regel aus `.gehirn/regeln.md` zu einer Architekturentscheidung, wandert sie
> hierher und wird dort auf eine Zeile gekürzt.

**Stand:** Phase 5 · **Zuletzt aktualisiert:** 2026-10-25 · **31 Einträge**

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

---

## ADR-0026 — Die ActionQueue ist idempotent, bevor sie etwas Echtes tut

**Kontext.** `delivery` reiht je Portal eine Aktion ein; der Worker validiert und führt aus.
Heute simuliert er nur, also ist eine doppelt eingereihte Aktion folgenlos. Sobald dort ein
echter Portal-Aufruf steht, ist dieselbe Zeile ein zweites Inserat — und die Wiederholung
entsteht nicht aus einem Fehler, sondern aus dem normalen Betrieb: ein zweiter Klick auf
Genehmigen, ein wiederholter Request, ein Neustart mit erneutem Lauf.

Nachträglich eingeführt hieße Idempotenz, jeden bestehenden Aufrufpfad noch einmal
anzufassen. Vorher eingeführt kostet sie einen Schlüssel und eine `Map`.

**Entscheidung.** Jede Aktion trägt einen **Idempotenzschlüssel**. Wird keiner mitgegeben,
leitet ihn `schluesselAus` deterministisch aus `(threadId, actionType, payload)` ab —
mit stabiler Serialisierung, damit die Feldreihenfolge im Payload den Schlüssel nicht
verändert, und mit Längenpräfixen, damit kein Feldinhalt die Grenze zum nächsten Feld
nachbilden kann. Ein bereits bekannter Schlüssel wird **nicht erneut geschrieben**;
`enqueueAction` gibt die id der vorhandenen Aktion zurück.

Die **Reihenfolge der Tore bleibt**: erst die Whitelist, dann die Dedup-Prüfung. Ein nicht
erlaubter Typ fliegt auch dann auf, wenn er einen bekannten Schlüssel mitbringt.

Dazu eine zweite, kleinere Zusage: der Worker verarbeitet **höchstens einen Durchgang
gleichzeitig**. Ohne diese Sperre kann der nächste Takt starten, während der vorige noch auf
einen Aufruf wartet, und dieselbe `PENDING`-Aktion ein zweites Mal aufnehmen. Bei einem
simulierten Aufruf fällt das nie auf; bei einem echten schon.

**Konsequenz.** Wer einen Vorgang bewusst wiederholen will, gibt einen **eigenen** Schlüssel
mit — der Schlüssel gehört dann dem Vorgang, nicht dem Text. Das ist der Fall, den ein
Portal-Aufruf braucht: dasselbe Inserat in zweiter Fassung bleibt derselbe Vorgang.

Eine abgelehnte oder endgültig gescheiterte Aktion bleibt im Index. Dieselbe Eingabe erneut
einzureihen ergibt kein zweites Ergebnis — ein neuer Versuch ist ein neuer Schlüssel und
keine stille Wiederholung.

**Grenze, ausdrücklich.** Der Index liegt im Arbeitsspeicher. Ein Neustart vergisst ihn — die
Aktionen selbst allerdings auch, sie stehen in derselben Liste. Beides schließt erst die
Persistenz aus **T11** (ADR-0025); bis dahin gilt die Zusage innerhalb eines Prozesslebens.
Sie steht damit auf derselben Stufe wie `MemorySaver`, nicht darunter.

---

## ADR-0027 — Dauerhaftigkeit als eigene Datei-Schicht, nicht als Paket

**Kontext.** T11 verlangt, dass ein Neustart keine wartende Genehmigung verliert. Drei Dinge
lagen im Arbeitsspeicher: der Checkpointer (`MemorySaver`), die Artefakt-`Map`s beider
Domänen und seit ADR-0026 der Dedup-Index der ActionQueue. Alle drei sind dasselbe Problem,
also brauchten sie dieselbe Antwort.

Der naheliegende Weg wäre `@langchain/langgraph-checkpoint-sqlite` gewesen. Er zieht
`better-sqlite3` nach — eine native Übersetzung. Damit hinge `clone → install → demo` auf
einer frischen Maschine an einer Build-Toolchain. Genau diese Zusage ist **T7**, ein
Prüfkriterium dieses Repos; ein grünes Kriterium gegen eine Bequemlichkeit einzutauschen wäre
der schlechteste Handel, den dieser Starter machen kann.

**Entscheidung.** Eine eigene, abhängigkeitsfreie Schicht: **ein append-only JSONL-Log je
Name** unter `STATE_DIR` (Vorgabe `.zustand/`), `node:fs` genügt — dasselbe Muster, das der
Trace seit T2.5 benutzt. Jede Zeile trägt `tenantId`, **jede Lesung filtert danach**
(ADR-0025); der Filter steht in `readLog` und nicht bei den Aufrufern, damit ihn niemand
vergessen kann.

Für den Checkpointer gilt eine zusätzliche Regel: **er wird nicht nachgebaut, sondern
geerbt.** `DateiCheckpointer extends MemorySaver` ergänzt nur Anhängen und Abspielen und
benutzt dabei ausschließlich dokumentierte Schnittstellen (`super.*`, `this.serde`); die
internen Felder `storage` und `writes` bleiben unberührt. Das Protokoll selbst — Elternkette,
Kanalversionen, `pendingWrites` — korrekt nachzubauen wäre die riskanteste Stelle des Repos:
ein Fehler darin verlöre genau die Läufe, die dieses Kriterium retten soll.

**Konsequenz.** Keine neue Abhängigkeit, kein Dienst, in CI lauffähig, und `.zustand/` darf
jederzeit gelöscht werden — ein leeres Verzeichnis ist der Anfangszustand, kein Fehler
(eigener Test). Aufrufer, die bewusst keinen dauerhaften Zustand wollen, geben schlicht
keinen `logName` an; die Queue bleibt dann flüchtig.

Ein Befund beim Bauen gehört hierher, weil er den Entwurf geformt hat: `serde.loadsTyped` ist
**asynchron**. Das Abspielen im Konstruktor reichte deshalb ein Promise statt eines
Checkpoints weiter — der Speicher blieb still leer, und der zweite Prozess fand das Artefakt,
aber keinen Lauf. Ein Konstruktor kann nicht warten; das Abspielen läuft seither **einmalig
beim ersten Zugriff**, wo gewartet werden darf. Nebeneffekt, der ohnehin erwünscht war: das
bloße Laden eines Moduls fasst keine Datei mehr an.

**Grenzen, ausdrücklich.** Das Log **wächst unbegrenzt** — keine Verdichtung, keine Rotation,
und abgespielt wird die ganze Historie. Es gibt **keine Sperre zwischen Prozessen**; der
Ablauf dieses Repos ist seriell. Beides steht als eigene Zeile in `ARCHITECTURE.md` §4. Wer
Dauerbetrieb braucht, tauscht diese Schicht gegen eine Datenbank — die Schnittstelle
(`appendLog`, `readLog`, `createArtifactStore`) ist genau dafür klein gehalten.

---

## ADR-0028 — Der Ausgabevertrag der Domäne `immobilien`

**Kontext.** Der `contractChecker` prüfte bis hierher eine einzige Regel: jede Zahl im
Inserat muss aus einem Zahlenfeld stammen. Der Datensatz aus der Kundenerkundung (10 Objekte,
12 absichtlich fehlerhafte Inserate) hat diese Regel zum ersten Mal ausgeführt — und sie hielt
an vier Stellen nicht. Zwei davon waren **Falschvorwürfe**, und die sind gefährlicher als
übersehene Fehler: der Writer bekommt sie als Feedback und lernt daraus, korrekte Angaben
wegzulassen.

**Entscheidung — der Vertrag in vier Sätzen.**

1. **Belegt ist, was in einem Feld steht — auch in einem Textfeld.** Adresse, Objektart,
   Beschreibung und Provision hat die Kundin oder der Kunde selbst geschrieben; sie zu
   zitieren ist kein Erfinden. Steht in der Beschreibung „mit zwei Balkonen", darf das Inserat
   zwei Balkone nennen. Dass diese Menge nur als Wort dasteht, ändert nichts an ihrer Herkunft.
2. **Leer heißt auslassen.** Für ein leeres Feld darf kein Wert entstehen — weder Zahl noch
   Buchstabe. **Kein `nicht angegeben`-Vermerk:** die Regel bleibt damit rein negativ und ist
   prüfbar, ohne dass der Writer alle fehlenden Felder aufzählen müsste. Ein Inserat, das seine
   Lücken auflistet, liest sich zudem wie ein Formular.
3. **Die Provision gehört ins Inserat.** Sie steht als Textfeld im Datensatz. Sie als
   „unbelegte Zahl" abzulehnen hieß, dem Writer das Weglassen einer in Deutschland
   vorgeschriebenen Angabe anzutrainieren.
4. **Der Energieausweis wird eigens geprüft**, weil er kein Zahlenfeld ist. Ist er gefüllt,
   muss die Klasse im Text stehen und stimmen; ist er leer, darf keine behauptet werden. Ein
   reiner Zahlenvergleich kann einen Buchstaben grundsätzlich nicht sehen.

**Dazu zwei Defekte, die derselbe Datensatz aufgedeckt hat** — keine Vertragsfragen, sondern
Rechenfehler:

- `normalizeNumber` entfernte **alle** Punkte, auch den Dezimalpunkt des **Feldwerts**: `82.5`
  wurde zu `"825"` und passte nie zum korrekt geschriebenen `82,5` im Text. Ein Objekt mit
  dezimaler Wohnfläche klagte sich damit selbst an. Ein Zahlenwert wird jetzt nicht mehr wie
  Text behandelt.
- Ein Leerzeichen als Tausendertrennzeichen (`695 000`, auch das geschützte aus
  Textverarbeitungen) zerfiel in zwei Zahlen, die beide als unbelegt galten.

**Und eine Verhaltensänderung am `portfolioLoader`: fail-closed.** Findet sich keine oder eine
unbekannte Objekt-ID, endet der Lauf, statt still auf den ersten Datensatz auszuweichen. Der
alte Rückfall war bequem und gefährlich: ein Inserat für das **falsche** Objekt geht an ein
Portal und trägt einen echten Preis; ein abgebrochener Lauf kostet eine Minute. Dieselbe
Haltung wie an der Genehmigungskante (T2.3). Getragen wird der Abbruch von `portfolioFehler`
im State und **BREMSE1b** — ohne sie schickte BREMSE4 („kein Objekt → laden") den Lauf endlos
im Kreis, also genau in den Defekt, mit dem dieses Repo in Phase 0 angefangen hat. Deshalb
prüft ihn ein Lauf durch den echten Graphen und nicht nur ein Unit-Test.

**Konsequenz.** Das Tor prüft **Herkunft, nicht Wahrheit**: ist die Beschreibung der Kundin
oder des Kunden falsch, erbt das Inserat den Fehler. Die Daten des Kunden zu bestreiten ist
nicht Aufgabe dieses Systems — diese Grenze steht im Dateikopf des Checkers, damit sie
niemand für ein Versehen hält.

Eine Erwartung im Datensatz hat sich durch Satz 1 **gedreht**: N07 („zwei Balkone") galt als
Fund, ist aber belegt — P06 schreibt es selbst in seiner Beschreibung. Der Verdacht war
richtig, das Ziel falsch gewählt; der echte Fall ist N11, wo dieselbe Zahl in keinem Feld
steht. Beide bleiben im Datensatz: das Paar zeigt, dass die Herkunft entscheidet und nicht die
Schreibweise.

**Was das NICHT ist.** Kein Messwert für T8. Im Mock-Modus ersetzt `listingWriter` die
Modellantwort durch einen aus dem Datensatz gebauten Text — der Vertrag ist dann per
Konstruktion erfüllt. Gemessen wird hier das **Tor**, nicht der Writer. T8 selbst braucht ein
echtes Modell (Schicht B, ADR-0019).


## ADR-0029 — Der Harness wird über Adapter parametrisiert, nicht über Verzweigungen

**Kontext.** `evals/runners/policy.js` war an sechs Stellen an die Domäne `report` gebunden:
Guardrail-Schwellen, Runner, Artefaktabfrage, ActionQueue, Datensatzpfad und das Feld
`domaene` im Bericht — dazu zwei Agentennamen (`writerAufrufe`, `criticAufrufe`) mitten in der
Erwartungsprüfung. Die Domäne `immobilien` lief seit Phase 5, war bei T10 und T11 grün und
hatte seit dem Vertragsschritt 27 Tests. Von `npm run evals` wurde sie **nicht angefasst**.
Der Befehl meldete grün und meinte dabei die halbe Wahrheit — genau die Form von Beweis, die
dieses Repo bestreitet.

**Entscheidung — fünf Teile.**

1. **Je Domäne ein Adapter** unter `evals/domains/<domäne>/adapter.js` mit sechs Feldern:
   `name`, `eingang`, `guardrailSchwellen`, `runner`, `artefaktstatus`, `aktionen`,
   `datensatz`. Der Runner kennt danach keine Domäne, keinen Agenten und keinen Aktionstyp.
   Die Naht liegt an denselben Stellen wie im Kern (ADR-0018): Verfahren im Runner, Bedeutung
   im Adapter. `artefaktstatus` ist das deutlichste Beispiel — `report` endet auf `PUBLISHED`,
   `immobilien` auf `DELIVERED`, und der Runner vergleicht nur Zeichenketten.
2. **Eine explizite Liste** in `evals/domains/index.js` statt eines Verzeichnis-Scans. Ein
   Scan nähme eine Domäne still aus der Messung, sobald ihre Datei anders heißt, und der
   Harness meldete weiter grün. Eine fehlende oder falsch benannte Domäne muss laut sein;
   `ladeAdapter` prüft deshalb auch die sechs Pflichtfelder und den Namen.
3. **Knotenzählungen generisch.** Eine Erwartung `<knoten>Aufrufe` zählt, wie oft der Knoten
   in der Sequenz steht. Die Datensätze bleiben unverändert — nur die Stelle, die sie liest,
   weiß nichts mehr über Agentennamen.
4. **Ein Bericht je Domäne** (`<datum>-schicht-a-<domäne>.json`). Ein gemeinsamer Name
   überschriebe die erste Domäne mit der zweiten; der Bericht hieße „Schicht A" und meinte
   nur die letzte. Der Exit-Code ist gemeinsam: eine grüne Domäne rettet keine rote.
5. **Der Kostenzähler wird zwischen Domänen zurückgesetzt.** Er ist ein Prozesszustand, kein
   Laufzustand. Ohne Rücksetzen trüge die zweite Domäne den Verbrauch der ersten mit, und
   Metrik 3.6 meldete für sie eine Zahl, die zur Hälfte einer anderen Domäne gehört.

**Prüfkriterium, und es ist erfüllt.** Der Bericht der Domäne `report` ist nach dem Umbau
**Zeichen für Zeichen derselbe** wie der vom 2026-09-06 — bis auf den Zeitstempel. Ein
Refactor der Messschicht, der die Messwerte verschiebt, wäre wertlos: man wüsste danach nicht
mehr, ob sich das System oder nur sein Maßstab geändert hat.

**Konsequenz.** Eine dritte gemessene Domäne kostet einen Adapter und einen Eintrag in der
Liste — null Zeilen im Runner. Das Prüfkriterium aus ADR-0018 gilt damit auch für die
Messschicht und nicht nur für `src/kernel/`. Dafür gibt es jetzt zwei Registrierungsstellen
(`src/kernel/registry.js` und `evals/domains/index.js`), die auseinanderlaufen können: eine
registrierte, aber nicht gemessene Domäne fiele niemandem auf. Das bleibt eine offene Grenze.

**Was das NICHT ist.** Kein Messwert für T8. Schicht A misst Routing und Richtlinien; im
Mock-Modus baut `listingWriter` seinen Text aus dem Datensatz, der Vertrag ist per
Konstruktion erfüllt und die Revisionsschleife wird nie erreicht. T8 braucht ein echtes
Modell (Schicht B, ADR-0019).


## ADR-0030 — T8 misst den ERSTEN Versuch, nicht das Ergebnis der Revisionsschleife

**Kontext.** T8 („Vertragskonformität = 100 %") ist das letzte offene Kriterium der Phase 5,
das eine Zahl braucht. Beim Bau des Schicht-B-Harness stellte sich die Frage, was ein „Lauf"
im Sinne von `EVALS.md` §3.8 überhaupt ist. Der Graph darf nach einer Beanstandung erneut
schreiben: `contractChecker` entfernt das betroffene Portal, BREMSE6b schickt den Lauf zurück
zum `listingWriter`, und das bis zu fünfmal. Zählt man das Ergebnis **nach** dieser Schleife,
steht am Ende fast zwangsläufig 100 % — und zwar unabhängig davon, wie gut der Writer ist.

**Entscheidung — fünf Teile.**

1. **T8 ist die Konformität im ERSTEN Versuch.** Nenner: alle erzeugten Inserate. Zähler: die,
   die das Tor auf Anhieb passieren. Nur diese Zahl sagt etwas über den Writer. Der Wert
   **nach** der Revisionsschleife wird als eigene Kennzahl berichtet — er sagt, was das Tor
   einbringt, und beantwortet eine andere Frage. Beide stehen nebeneinander im Bericht,
   damit niemand die bequemere für T8 hält.
2. **Gemessen wird das PAAR Writer/Tor, nicht der Graph.** Schicht B ruft `listingWriterNode`
   und `contractCheckerNode` direkt auf — dieselben Funktionen, die auch der Graph aufruft,
   keine nachgebaute Schleife. Routing, HITL und Auslieferung misst Schicht A vollständig und
   kostenlos; sie hier mitzufahren kostete Geld und brächte keine Aussage über den Vertrag.
3. **Schicht B fährt gegen die zehn Datensätze der Kundenerkundung**, nicht gegen die
   Entwicklungs-Fixture — genau umgekehrt zu Schicht A (ADR-0029). Der Grund ist derselbe in
   beide Richtungen: Schicht A braucht Wiederholbarkeit und kommt mit einem Objekt aus;
   Schicht B braucht **Bandbreite echter Feldbelegungen** — leere Etage, fehlender
   Energieausweis, dezimale Wohnfläche, Provision als Text. Das sind die Stellen, an denen ein
   Modell den Vertrag verletzt.
4. **Ein Lauf, der Geld ausgibt, braucht eine Bremse vor dem Geld.** Der Harness hat eine
   Ausgabengrenze (`--max-usd`, Standard 1,00), eine Stichprobenverkleinerung (`--objekte`,
   `--portale`) für eine Rauchprobe von wenigen Cent, und einen `--dry-run`, der den Plan
   ausgibt (wie viele Aufrufe, welche Grenze) und **keinen einzigen** Modellaufruf macht. Ein Modellfehler beendet nicht den
   ganzen Lauf: was bereits gemessen wurde, ist bezahlt und gehört in den Bericht.
5. **Schicht B weigert sich im Mock-Modus** — das Spiegelbild der Weigerung in `policy.js`.
   Dort: „kein echtes Modell". Hier: „kein Mock". Im Mock baut `listingWriter` seinen Text aus
   dem Datensatz; der Vertrag wäre per Konstruktion erfüllt und die 100 % wären eine Aussage
   über den eigenen Fixture-Generator.

**Konsequenz.** Die erwartete Zahl ist **rot**, und das ist beabsichtigt: der heutige
Writer-Prompt nennt die Vertragsregeln, aber niemand hat je geprüft, ob ein echtes Modell sie
einhält. Ein Erstversuchs-Wert unter 100 % ist kein Rückschlag, sondern der erste echte
Messwert — die Baseline aus `EVALS.md` §5 sagt genau das voraus. Der Preis der Entscheidung:
T8 wird schwerer zu erfüllen als bei der bequemen Zählweise, und die Prompt-Arbeit am Writer
wird damit zu einer eigenen, messbaren Aufgabe statt zu einer Behauptung.

**Was hier NICHT entschieden ist.** Der Judge der Schicht B (`EVALS.md` §3.9–3.11) bleibt in
Phase 4 (ADR-0024). T8 braucht ihn nicht: der Vertrag dieser Domäne ist Arithmetik, kein
Urteil — dieselbe Eigenschaft, die schon den Berichtsvertrag aus §1.1 messbar machte.

**Stand.** Der Harness steht und ist bis an die Modellgrenze geprüft (Verweigerung im Mock,
Trockenlauf, Verdrahtung gegen einen absichtlich ungültigen Schlüssel, Exit-Codes). **Die
Messung selbst fehlt: in dieser Umgebung ist kein `ANTHROPIC_API_KEY` gesetzt.** T8 bleibt
damit offen — nicht weil etwas fehlt, sondern weil die Zahl noch niemand erzeugt hat.


## ADR-0031 — `PUBLISH_LISTING` läuft über den Security Core; der Portalschlüssel bleibt auf der Vertrauensseite

**Kontext.** Phase 5 verlangt den ersten echten Executor (`PRODUCT.md` §7). Bis hierher
simuliert `processOne` nur. Ein echter Portal-Aufruf im Prozess von agentic-starter hieße:
der Portalschlüssel liegt im selben Prozess wie der Graph und der vom Modell geschriebene
Text, und die Abwehr von B2 hinge allein daran, dass dieser Code fehlerfrei ist.

Der Security Core aus `AISecuritySystem` bietet seit dem Tag `adapter-seam-v1` eine Naht
dafür: ein Produkt registriert eigene Tool Adapter über `startSecurityCore(composeAdapters)`;
sie laufen auf der Vertrauensseite neben ihrem Schlüssel, und die Agentenseite erreicht nur
TB-1 — genau eine Anfrage `POST /actions` je Verbindung, Antwort `executed`, `rejected` oder
`failed`. Der Vertrag zwischen Kern und Produkt steht dort in `docs/11-core-contract.md`
(CC-1 – CC-10).

Schritt 1 ist bewusst klein: ein genehmigtes Inserat gelangt über den Kern in ein
**Scheinportal**. Nichts verlässt die Maschine.

**Entscheidung — zehn Teile.**

1. **Der echte Executor gehört in diese Phase.** `docs/security-model.md` §7 sagt „Echte
   Executor bleiben außerhalb von v1"; der Satz stammt aus Phase 2. `PRODUCT.md` §5.2
   terminiert den echten Executor auf Phase 5, und Phase 5 läuft. Der erste echte Executor
   ist der dieses ADR: echte Mechanik, echte Prozessgrenze, echte Wirkung — auf einem
   Scheinsystem. Der Satz in §7, die Beschriftung „simuliert, Phase 5 echt" in Abb. 5 und
   die Zeile „Action-Executor simuliert" in `ARCHITECTURE.md` §4 werden im
   Dokumentenschritt nachgezogen. `report` bleibt simuliert.

2. **Der Kern ist gepinnt und unverändert.** Git-Submodul `vendor/security-core` auf Commit
   `157bdad8583b4a494643103ed9fcef8e89fe3b53` — das Ziel des annotierten Tags
   `adapter-seam-v1`, lokal und auf `origin` geprüft. Zwischen dem Commit des Nachweislaufs
   (`3d56872`) und dem Tag ändern sich nur Dokumente und Nachweisdateien. Kein npm-Paket:
   Node entfernt unter `node_modules` keine Typen
   (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Ein Test prüft, dass der Submodul-HEAD
   dieser Hash ist und `git status --porcelain` im Submodul leer bleibt (CC-4). Der Pin
   ändert sich nur durch ein neues ADR (CC-2). Die Vertrauensseite importiert aus dem Kern
   **ausschließlich** `minimal-core/src/core/start.ts` — die erklärte Naht (CC-5) —, keine
   Interna wie `shared/http.ts`, auch wenn sie bequem wären. Weil der Kern TypeScript per
   Type Stripping ausführt, verlangt `package.json` künftig `engines.node >= 24`; die CI
   läuft bereits auf 24.

3. **Drei Prozesse, und die Vertrauenslinie steht im Baum.**

   | Prozess | Seite | Einstieg | Umgebung |
   |---|---|---|---|
   | Scheinportal | Außenwelt | `src/bin/fakePortal.js` → `src/adapters/portal/fakePortal.js` | `PORTAL_SOCKET`, `PORTAL_CREDENTIAL_HASH_FILE` (Nachtrag) |
   | Security Core mit `publish_listing` | Vertrauensseite | `src/bin/securityCore.js` → `src/adapters/portal/publishListing.js` | `CORE_SOCKET`, `PORTAL_SOCKET`, `PORTAL_CREDENTIAL_FILE` |
   | agentic-starter | Agentenseite | `src/bin/demoImmobilien.js` (später `serve.js`) → `src/adapters/security-core/client.js` | nur `SECURITY_CORE_SOCKET` |

   Die Ringe aus ADR-0023 kennen keine Vertrauensseiten; dieses ADR ergänzt sie.
   **Vertrauensseite** sind `src/adapters/portal/publishListing.js`, `src/bin/securityCore.js`
   und `vendor/security-core/`; **Außenwelt** sind die beiden Portal-Dateien;
   **Agentenseite** ist alles übrige unter `src/`. Ein Strukturtest prüft beide Richtungen:
   die Agentenseite importiert nichts von der Vertrauensseite, der Außenwelt oder aus
   `vendor/`; die Vertrauensseite importiert nur `node:*`, die Naht `start.ts` und ihre
   eigenen Dateien — weder Kernel noch Domäne noch ein npm-Paket. So gelangen weder
   LangChain noch der `.env`-Lader aus `kernel/config/env.js` in den Prozess, der den
   Schlüssel hält.

4. **Der Schlüssel liegt in einer Datei, die nur die Vertrauensseite liest.** Format: das
   feste Präfix `asp_` und 64 Hex-Zeichen — das Präfix macht ein Leck durch Suche
   auffindbar, ohne den Wert zu kennen (wie `mcc_` im Kern). Gelesen wird er nur von
   `composeAdapters` in `bin/securityCore.js`. Das Scheinportal prüft ihn, hält dafür aber
   nur seinen SHA-256-Hash (Nachtrag). Fehlt die Datei, ist sie
   unlesbar oder hat sie das falsche Format, wirft `composeAdapters` einen `ConfigError` mit
   festem Text; der Kern beendet sich, bevor TB-1 lauscht, und gibt nie den Inhalt aus. Der
   Schlüssel steht **nie** in einer Umgebungsvariable, in `.env`, in einer `TenantConfig`,
   im Code, in einem Log, einem Queue-Eintrag oder einem Ergebnis von agentic-starter.
   `EXTEND.md` §6 („zuerst `TenantConfig.integrations`, dann globale env") gilt damit für
   Aktionen über den Kern nicht mehr; auch Schlüssel je Mandant (Phase 6) wären Sache der
   Vertrauensseite.

5. **Kernergebnisse werden auf Queue-Status abgebildet — ohne Wiederholung.**

   | Antwort des Kerns | Queue | Bedeutung |
   |---|---|---|
   | `executed` | `DONE` | Wirkung erfolgt; `result.listingId` wird mit dem Status protokolliert |
   | wohlgeformtes `rejected` | `REJECTED` | keine Wirkung; `reason` wird protokolliert |
   | `failed` — und alles andere: Zeitüberschreitung, Verbindungsfehler, unlesbare Antwort, Ausnahme im Executor | `FAILED` | Wirkung **unbekannt** |

   **Keine automatische Wiederholung**, für keine Domäne: die Regel „nach drei Versuchen
   `FAILED`" (`EXTEND.md` §6, `actionQueue.js`) entfällt. Nach `failed` kann ein zweiter
   Versuch ein zweites Inserat sein; die Idempotenz aus ADR-0026 verhindert ein zweites
   *Einreihen*, nicht eine zweite *Ausführung*, und sie reicht nicht bis ins Portal. Ein
   neuer Versuch ist die Entscheidung eines Menschen und damit ein neuer Schlüssel
   (ADR-0026, Konsequenz).

   **Absturz während des Aufrufs:** `PROCESSING` wird vor dem Aufruf ins Log geschrieben;
   findet das Abspielen eine Aktion in `PROCESSING`, wird sie `FAILED`. Das kehrt eine
   Entscheidung aus T11 um — `ARCHITECTURE.md` §4 und der Kommentar in `actionQueue.js`
   lassen `PROCESSING` bewusst aus dem Log, damit die Aktion als `PENDING` zurückkommt, „die
   Idempotenz trägt ihn". Für einen simulierten Aufruf stimmte das, für einen echten nicht.
   Ein Absturz zwischen Logzeile und Versand ergibt nun `FAILED`, obwohl nichts gesendet
   wurde — die sichere Richtung.

   Tor 1 und Tor 2 bleiben; sie verschärfen nur und erlauben nichts (CC-8). Tor 2 und der
   Adapter zählen `text.length` — UTF-16-Einheiten, keine Zeichen (höchstens 5000; ein Emoji
   zählt zwei) —, der Kern zählt Bytes (16 KiB je Anfrage). Mehrbyte-Text allein überschreitet
   die Grenze nie: das Maximum liegt bei 15 077 Bytes (5000 × `€`). Erst Steuerzeichen, die
   JSON als `\u00XX` schreibt (6 Bytes je Einheit), tun es: ein solcher Text passiert Tor 2
   und kommt als `rejected`/`request_too_large` zurück — dann `REJECTED`, keine Wirkung. Ein
   Test mit Steuerzeichen belegt das.

6. **Der Executor ist Pflicht — am Worker, nicht an der Queue.**
   `startActionWorker({ executor, intervalMs })` wirft ohne Executor. An
   `createActionQueue` gehört er nicht: die Queue ist ein Modul-Singleton der Domäne
   (`domains/<domäne>/actions.js`), und eine Domäne importiert keinen Adapter
   (`ARCHITECTURE.md` §6) — ein Executor bei der Erzeugung erzwänge genau diesen Import.
   Wer den Worker startet, setzt den Executor ein. `report` bekommt einen ausdrücklichen
   Simulations-Executor in `domains/report/actions.js`, weil sein Veröffentlichungsweg
   simuliert bleibt; `immobilien` hat im Produktcode **genau einen** Executor, den über den
   Kern. Kein versteckter Standard, kein Zweig „Mock oder echt". Tests und Schicht A setzen
   einen eigenen Test-Executor ein: Schicht A misst Tor 1 und Tor 2, nicht die Wirkung —
   die Wirkung misst der Integrationstest. `src/kernel/` bleibt bei 18 Dateien (ADR-0021).

7. **Verdrahtet wird in `src/bin/`.** Der TB-1-Client (`src/adapters/security-core/client.js`)
   ist domänenfrei: er kennt weder `PUBLISH_LISTING` noch `publish_listing` und importiert
   nur `node:*`. Er schickt je Verbindung eine Anfrage mit dem Körper genau
   `{action, arguments}`, hat eine feste Zeitgrenze, die länger ist als die des Adapters zum
   Portal, wirft nie und liest die Antwort so streng wie `interpretOutcome` im Kern. Den
   Kernnamen eines Queue-Typs erklärt die Domäne (`domains/immobilien/actions.js`:
   `PUBLISH_LISTING` → `publish_listing`, Muster `^[a-z][a-z0-9_]{0,63}$`); `bin/` setzt
   zusammen — Typ → Kernname, Payload unverändert → `arguments`. `threadId` und
   `idempotencyKey` verlassen die Agentenseite nicht. Fehlt `SECURITY_CORE_SOCKET`, startet
   der Worker nicht: eine fehlende Konfiguration ist kein Ergebnis einer Aktion und darf
   keine Aktion auf `FAILED` setzen.

8. **`DELIVERED` heißt „eingereiht", nicht „veröffentlicht".** `delivery` setzt das
   Artefakt beim Einreihen auf `DELIVERED` — vor jeder Ausführung. Ob ein Inserat online
   ist, sagt der Queue-Status `DONE` mit seiner `listingId`, nicht das Artefakt. Die
   Bedeutung bleibt (Schicht A vergleicht `DELIVERED`, ADR-0029); sie wird festgehalten,
   nicht umbenannt. Durch Ausführen belegt (2026-10-25): `npm run demo:immobilien` endet
   mit Exit 0 und Artefakt `DELIVERED`, das Queue-Log enthält drei `enqueue`-Zeilen und
   keine einzige Statuszeile — der Worker von `immobilien` wird im Produktcode (`src/`)
   nirgends gestartet; nur der Schicht-A-Harness startet ihn für seine Aktionsfälle
   (`evals/runners/policy.js`).

9. **Die drei Fragen aus CC-6, für das Scheinportal beantwortet.**
   - **Q-25 — trägt das Ergebnis eine Berechtigung?** Nein. Der Adapter gibt nur
     `{listingId}` zurück, typgeprüft. Das Scheinportal hat genau einen Endpunkt mit
     Wirkung, `POST /listings`, und keiner nimmt eine `listingId` als Berechtigung an.
   - **P-20 — wie wird der Empfänger des Schlüssels geprüft?** Der Adapter sendet den
     Schlüssel nur an einen Socket-Pfad (`PORTAL_SOCKET`), nie an eine Netzadresse — die
     Lehre aus Befund F2 des Kerns. Dass nur das Portal diesen Pfad halten kann, belegen
     erst die Verzeichnisrechte im WSL2-Lauf. Lokal unter Windows (Named Pipe, ein
     Benutzer) ist es **nicht** belegt.
   - **Q-22 — warum geht es nicht am Kern vorbei?** Jede Wirkung im Portal verlangt den
     Schlüssel; der Benutzer von agentic-starter kann die Schlüsseldatei nicht lesen und
     den Portal-Socket nicht öffnen. Auch das zeigt erst der WSL2-Lauf.

   Für ein echtes Portal werden alle drei neu gestellt.

10. **Was danach behauptet werden darf (CC-9).** Nach dem lokalen Lauf: „Der
    Veröffentlichungsweg im Code führt über den Kern; im Code und in der Umgebung von
    agentic-starter steht kein Portalschlüssel." Ein **„nur"** trägt diese Aussage nicht:
    unter Windows laufen alle drei Prozesse unter einem Benutzer, und der Prozess von
    agentic-starter könnte die Schlüsseldatei lesen und das Portal direkt ansprechen. Erst
    nach dem WSL2-Lauf: „`PUBLISH_LISTING` erreicht das Scheinportal nur über den Security
    Core (`adapter-seam-v1`, unverändert); der Portalschlüssel ist nur für den Benutzer des
    Kerns lesbar, und der Benutzer von agentic-starter erreicht das Portal nicht direkt."
    Jede Aussage nur mit einem datierten Lauf.

    **Nicht behauptet:**
    - Die Aussagen des Kerns (CC-3: Minimal Core, Egress-Kontrolle) gehen **nicht** über.
      agentic-starter läuft nicht in der Domäne, die der Launcher des Kerns baut (CC-7):
      sein Prozess hat Netz, Dateien und den Modellzugang seines Benutzers.
    - **HITL ist kein Sicherheitstor.** `resolveApproval` ist eine Inhaltsfreigabe innerhalb
      von agentic-starter. TB-1 ist nicht authentifiziert, und `decide.ts` erlaubt jede
      gültige Aktion: wer den Kern-Socket öffnen kann, veröffentlicht ohne Freigabe — auch
      ein kompromittierter Prozess von agentic-starter. B6 in `docs/security-model.md` §2
      hält damit gegen ein fehlgeleitetes Modell (Agenten haben nur die Queue), nicht gegen
      kompromittierten Code auf der Agentenseite. Eine Sicherheitsfreigabe ist Arbeit des
      Kerns (TB-3, Q-09).
    - Keine Richtlinie, kein Audit, keine Identität (Q-06, Q-13, Q-02/Q-03).
    - Kein echtes Portal; nichts verlässt die Maschine.
    - Der lokale Lauf unter Windows ist ein Funktionsnachweis, kein Trennungsnachweis.

**Konsequenz.** Drei Prozesse statt einem: der Integrationstest startet Scheinportal und
Kern als Kindprozesse, wie `tests/integration/persistence.test.js` es für T11 vormacht.
Node 24 wird Pflicht. **Der Security Core ändert sich nicht** — keine Zeile unter
`vendor/security-core/`, das prüft der Test aus Teil 2. Der eigene Kernel (`src/kernel/`)
ändert sich an einer Stelle, der Queue-Mechanik — Worker-Signatur, Abbildung der
Ergebnisse, Wegfall der Wiederholung, `PROCESSING` im Log. Jede dieser Änderungen ist eine
eigene Aufgabe mit eigenem Test; die bestehenden Queue-Tests ändern ihren Aufruf, nicht ihr
Ergebnis, und der Bericht der Schicht A bleibt für beide Domänen zeichengleich (bis auf den
Zeitstempel). Die Liste der Portale steht danach an zwei Stellen — `TARGET_PORTALS` in der
Domäne, die bekannte Menge im Adapter —, weil die Vertrauensseite die Domäne nicht
importieren darf; ein Test vergleicht beide.

**Grenzen, ausdrücklich.** Doppelte Veröffentlichung ist nicht ausgeschlossen, nur nicht
mehr automatisch: hat ein als `FAILED` markierter Aufruf in Wahrheit gewirkt und reiht ein
Mensch ihn neu ein, entsteht ein zweites Inserat. Schließen kann das erst ein
Idempotenzschlüssel, den das Portal selbst kennt. Ein Verbindungsfehler vor dem Senden
ergibt ebenfalls `FAILED`, obwohl beweisbar nichts gesendet wurde — bewusst streng: der
Client unterscheidet nicht, wie früh eine Verbindung scheiterte.

**Was hier NICHT entschieden ist** (Schritt 2 und später). Dass der Agent in der Domäne des
Launchers läuft (CC-7) und sein Modellzugang über den Kern geht (Q-26) — samt der Frage, wo
`.zustand/` dann schreiben darf. Ein echtes Portal mit eigenem Idempotenzschlüssel und den
drei Fragen aus Teil 9. Richtlinie, Sicherheitsfreigabe, Audit, Identität — Arbeit des
Kerns. Ein echter Executor für `report`. Eine HTTP-Route für `immobilien` (`server.js`
verdrahtet heute nur `report`) und die Beraterkonsole.

**Stand.** Freigegeben 2026-10-25. Wie weit die Umsetzung ist — Teile, Kriterien, Nachweise —,
steht nur in `docs/kern-integration.md`. Dieses ADR trägt die Entscheidungen; Einzelheiten
(Dateien, Variablen, Tests) ändern sich ab hier im Spec, nicht hier — zwei Kopien derselben
Angabe driften (ADR-0012).

**Nachtrag (2026-10-25, Teil 3): das Scheinportal hält nur den SHA-256-Hash des Schlüssels**
(`PORTAL_CREDENTIAL_HASH_FILE`, genau 64 Hex-Zeichen) statt der Schlüsseldatei; die Zeile
des Scheinportals in der Tabelle aus Teil 3 liest damit `PORTAL_SOCKET` und
`PORTAL_CREDENTIAL_HASH_FILE`. Grund ist die Aussage aus Teil 10: „der Portalschlüssel ist
nur für den Benutzer des Kerns lesbar" wäre mit einer gemeinsamen Datei (Gruppe, `0440`)
falsch, weil auch der Benutzer des Portals sie läse. So liegt der Schlüssel an genau einer
Stelle. Preis: der Operator erzeugt zwei Dateien.

**Berichtigt (2026-10-25)** nach einer Durchsicht gegen Code und Tests: Teil 5 sprach von
„Zeichen" und „Mehrbyte-Text" — gezählt werden UTF-16-Einheiten, und nur Steuerzeichen
überschreiten 16 KiB (durch Ausführen gemessen). Teil 8 sagte „nirgends gestartet" — der
Schicht-A-Harness startet den Worker. „Stand" sagte „kein Code"; Teil 3 und Teil 4 standen
noch vor dem Nachtrag. Die Stellen sind oben korrigiert und hier benannt, nicht still
überschrieben.
