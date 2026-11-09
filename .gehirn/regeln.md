# Projektregeln

Die hier eingetragenen Regeln sind **verbindlich**. Zu Sitzungsbeginn gelangen die ersten
60 Zeilen automatisch in den Kontext — die nützlichsten Regeln gehören deshalb nach oben.

Diese Regeln gelten speziell für `agentic-starter`. Allgemeine Präferenzen (TypeScript,
Next.js, Mongoose, Git) stehen in der globalen `~/.claude/CLAUDE.md` und werden hier nicht
wiederholt.

## Regeln

- **Regel (2026-11-09):** Ziel und geplante Arbeit werden auf der **einfachsten, grundlegenden
  Stufe** geplant und genauso umgesetzt. Ziel ist eine Anwendung, die auf grundlegender Stufe
  läuft und getestet ist. **Keine Verwicklungen.** Wird eine Prüfung größer als geplant, wird
  nicht nachgerüstet, sondern angehalten und gefragt. **Grund:** Teil 5 wuchs von „C1–C6" zu
  einem Nachbau der Kern-Probe (Dateisuche, setuid, Capabilities, D2-Wechsel); dazu zwei
  eigene Fehler (Lauf vor dem CI-Ergebnis, `guiApplications=false` übergangen), die den Lauf
  entwerteten. Die Nutzerin oder der Nutzer: „hiçbir karışıklığa girilmeyecek".

- **Regel:** Ändert eine Änderung Struktur, Philosophie oder Ziel des Projekts, werden
  `README.md`, `CLAUDE.md`, `PRODUCT.md`, `ARCHITECTURE.md` **im selben Zug** geprüft und
  aktualisiert — nicht erst auf Nachfrage. **Grund:** Nach dem Bau der Domäne `immobilien`
  (Phase 5, T10) blieben alle vier stehen; `README.md` beschrieb die bereits gelöschte
  flache `src/`-Struktur, `CLAUDE.md` behauptete, `domains/`/`adapters/` gäbe es noch nicht.

- **Regel:** Keine Zahl in README oder Dokumenten, die nicht aus einem datierten Lauf in
  `evals/reports/` stammt. Was nicht gemessen wurde, trägt die Markierung „nicht gemessen" —
  nicht eine plausibel aussehende Zahl. **Grund:** Die übernommene Strategiedatei
  `docs/referans.md` enthielt erfundene Metriken als README-Vorlage (94,2 % Accuracy,
  „1000+ Threat Detections"). Genau dieser Fehler ist der Grund, warum es dieses Projekt gibt.

- **Regel:** Fremde Planungstexte sind Vorschläge, keine Quellen. Prüf sie gegen die
  Vertragsdokumente, bevor du etwas übernimmst. **Grund:** `docs/referans.md` widersprach an
  vier Stellen bereits getroffenen Entscheidungen (ADR-0009, Nicht-Ziele aus `PRODUCT.md`
  §5.2) und wurde trotzdem als „Plan" weitergereicht.

- **Regel:** Ab Phase 2 wird `src/` nur entlang der Aufgabenliste geändert — **ein Defekt
  pro Änderung**. **Grund:** Dass eine Verbesserung gegenüber der Baseline belegbar ist,
  hängt daran, dass jede Änderung genau einer Metrik zuzuordnen ist. Zwei Defekte in einem
  Zug behoben heißt: nicht mehr feststellbar, welcher die Zahl bewegt hat.

- **Regel:** Geh Schritt für Schritt vor und frag nach. Nimm nichts an. **Grund:** Das Gerüst
  wird gemeinsam gebaut; in einem Zug erzeugte Dateien zementieren still Entscheidungen,
  deren Rücknahme teuer ist. **Zusatz (2026-10-25):** erst Spec, dann Code auf der
  einfachsten Stufe; die Grundlage minimal bauen, prüfen, testen — erst dann der nächste
  Schritt, Einzelheiten darauf. Eine Plan-Freigabe ist keine Freigabe des Inhalts.

- **Regel:** „Fertig" darf erst gesagt werden, wenn der Prüfbefehl durchläuft. Dass eine Datei
  existiert, ist kein Beweis. **Grund:** In Phase 0 waren die Häkchen für Woche 1–2 nach
  Dateiexistenz gesetzt — obwohl beide Wochen ihr eigenes Ziel verfehlten. Genau dieser Fehler
  ist der Grund, warum es dieses Projekt gibt. **Zusatz (2026-10-25):** ein noch nicht
  geschriebener Test steht in Plänen als „geplant", nie wie vorhanden; „erledigt" nur mit
  Commit und Prüfbefehl daneben.

- **Regel:** Neue Dateien entstehen direkt an ihrem Zielort (`ARCHITECTURE.md` §6). Es gibt
  keine vorläufige Ablage. **Grund:** Eine später umgezogene Datei bricht den Vergleich zur
  Baseline; genau deshalb wurde die Zielstruktur in ADR-0023 vor dem Umzug festgelegt.

- **Regel:** Prüfe einen Befund durch Ausführen, bevor du ihn meldest. Ein aus dem Code
  gelesenes Ergebnis ist nicht „verifiziert". **Grund:** In Phase 0 sah die CRLF-Hypothese
  beim Lesen richtig aus und erwies sich beim Ausführen als falsch; in derselben Runde wurde
  auch die langsmith-Diagnose zunächst falsch gedeutet.

- **Regel:** Zeig, was du schreiben willst, bevor du ins Repo schreibst. Erzeuge keine Dateien
  im Block. **Grund:** Die Erzeugung wurde zweimal gestoppt; ohne Freigabe angelegte Dateien
  hinterlassen Reste, die wieder aufgeräumt werden müssen.

- **Regel:** Eine Oberfläche wird aus Sicht der Person entworfen, die das System benutzt, und
  folgt der Produktanalyse — nicht der inneren Mechanik (ADRs, BREMSEn, Evals). Vor einem
  UI-Entwurf erst ein Plan im Frage-Antwort-Verfahren, kein Code. **Grund:** Der erste
  UI-Plan (2026-09-07) war „çok karışık, hiçbir şey anlaşılmıyor" — er zeigte, wie das System
  arbeitet, statt womit die Beraterin oder der Berater konfrontiert wird.

- **Regel:** `template/` war ein aus einem anderen Projekt übernommenes „Gehirn"-System —
  kein zu löschender Ballast, sondern eine **anzupassende Quelle**. **Grund:** In der ersten
  Analyse wurde es für Aufräummüll gehalten; die Nutzerin oder der Nutzer hat korrigiert.

## Wie diese Liste wächst

Wenn du korrigiert wirst („mach das nicht so", „nie wieder so"), trage die Korrektur in
derselben Sitzung als neuen Punkt ein: **welche Regel**, **warum sie existiert**. Halte dich
nah an die Formulierung der Nutzerin oder des Nutzers, füge keine eigene Deutung hinzu.

Ist eine Regel überholt, lösch oder überschreib sie; lass keine zwei widersprüchlichen Punkte
nebeneinander stehen. Wird die Liste lang, wandern die nützlichsten nach oben — die ersten
60 Zeilen sind das Injektionsfenster.

Reift eine Regel zu einer Architekturentscheidung, **befördere sie** als ADR nach
`DECISIONS.md` und kürze den Punkt hier auf eine Zeile.
