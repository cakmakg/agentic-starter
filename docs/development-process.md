# Entwicklungsprozess — Arbeiten mit einem Coding-Agenten

Dieses Dokument beschreibt, wie in diesem Repo mit einem Coding-Agenten gearbeitet wird:
wie das Gedächtnis funktioniert, wer was wann liest und schreibt, und welche Disziplin
verhindert, dass „erledigt" ohne Beleg gesagt wird.

Es ist zugleich der Nachweis für Achse 03 der Kompetenzkarte (*Coding-Agenten einsetzen*).

---

## 1. Das Gedächtnis: was automatisch passiert und was nicht

Der Agent liest `.gehirn/` **nicht laufend**. Ein `SessionStart`-Hook injiziert **einmal
zu Sitzungsbeginn** einen definierten Ausschnitt in den Kontext. Alles andere wird nur
gelesen, wenn der Agent es bewusst öffnet.

| Datei | Was injiziert wird | Anteil |
|---|---|---|
| `kern.md` | vollständig | 100 % |
| `regeln.md` | die ersten 60 Zeilen | 100 % (solange sie passen) |
| `letzte-sitzung.md` | nur der oberste Block, max. 50 Zeilen | ~66 % |
| `themen.md` | nur `## Aktive Themen`, Titel- und Statuszeilen, max. 6 Themen | ~41 % |

Gesamtbudget: **16.000 Zeichen**. Abschnittsgrenzen: 3000 + 4000 + 2000 + 4000 = 13.000.
Die Summe liegt bewusst unter dem Gesamtbudget — deshalb braucht der Hook keine gestaffelte
Kürzungslogik. Wer eine Grenze anhebt, muss diese Summe nachrechnen.

> ⚠️ **Die stille Falle:** Wächst `regeln.md` über 60 Zeilen, werden die überzähligen Regeln
> **wortlos nie geladen**. Die Datei sieht vollständig aus, wirkt aber nur teilweise. Genau
> dafür gibt es Prüfung 6 im `projekt-doktor`, die `Regeln: 7/7 im Fenster` meldet.

## 2. Lesereihenfolge und ihr Zweck

Die Reihenfolge der Injektion ist bewusst gewählt: **Identität vor Kontext, Kontext vor
Arbeitsliste, Arbeitsliste vor Regeln.**

| # | Abschnitt | Beantwortet die Frage |
|---|---|---|
| 1 | `[Gedächtnis: Kern]` | Was ist dieses Projekt, was darf ich nie vergessen? |
| 2 | `[Gedächtnis: Letzte Sitzung]` | Wo sind wir stehen geblieben? |
| 3 | `[Gedächtnis: Offene Themen]` | Was ist noch offen? |
| 4 | `[Gedächtnis: Verbindliche Regeln]` | Woran bin ich gebunden? |

**Auf Abruf, während der Sitzung** — nichts davon kommt automatisch:

- die abgeschlossenen Themen in `themen.md` — „haben wir das schon einmal besprochen?"
- die früheren Sitzungen in `letzte-sitzung.md` — die Herkunft einer Entscheidung
- `PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `EVALS.md` — vor jeder Entscheidung

**Am Sitzungsende schreibt der Agent** (siehe `CLAUDE.md` → Gedächtnisprotokoll):
`letzte-sitzung.md`, `themen.md`, bei einer Korrektur auch `regeln.md`.

## 3. Wer besitzt welches Wissen

Ein einziger Ort pro Information — sonst driften zwei Gedächtnisse auseinander.

| Datei | Besitzt | Wird geladen |
|---|---|---|
| `CLAUDE.md` | Wegweiser, Autoritätskette, Gedächtnisprotokoll | von Claude Code, immer |
| `.gehirn/kern.md` | Projektidentität, „niemals vergessen" | vom Hook, immer |
| `.gehirn/regeln.md` | verbindliche Konventionen | vom Hook, erste 60 Zeilen |
| `.gehirn/themen.md` | offene Arbeit | vom Hook, aktive Themen |
| `.gehirn/letzte-sitzung.md` | Kontinuität | vom Hook, oberster Block |
| Repo-Dokumente | dauerhafte Wahrheit | auf Abruf |

Reift ein Thema zu einer Entscheidung, **wandert es** nach `DECISIONS.md` und die Spur in
`.gehirn/` wird auf eine Zeile gekürzt. Das ist keine Formsache: `.gehirn/` ist ein
Arbeitsspeicher, kein Archiv.

## 4. Die Rolle des Menschen: drei Eingaben

Es muss **keine Datei manuell geteilt werden** — der Hook erledigt den stehenden Kontext.
Was der Mensch beiträgt:

**1 · Die Aufgabe.** Nur sagen, was gebraucht wird. Der Kontext ist bereits geladen.

**2 · Die Korrektur — die wertvollste Eingabe.** Sätze wie „mach das nicht so" oder „nie
wieder so" werden **in derselben Sitzung** als Regel eingetragen: *welche Regel*, *warum sie
existiert*, nah an der ursprünglichen Formulierung. Sämtliche Regeln in `regeln.md` sind so
entstanden — keine davon ist ausgedacht.

**3 · Die Abschlussentscheidung.** Wann ein Thema geschlossen ist, entscheidet der Mensch.

## 5. Wartungsrhythmus

| Wann | Was zu tun ist |
|---|---|
| Jede Sitzung | Nichts. Läuft automatisch. |
| Nach einer Korrektur | Prüfen, ob die Regel wirklich eingetragen wurde |
| Am Ende einer Phase | `projekt-doktor` ausführen — Prüfungen 5, 6 und 7 kontrollieren das Gedächtnis |
| Bei mehr als 6 aktiven Themen | Der Doktor meldet 🟡; das am wenigsten dringende Thema schließen |
| Wenn eine Regel reift | Als ADR nach `DECISIONS.md` befördern, hier auf eine Zeile kürzen |

## 6. Die Aufgabenvorlage

Jede an den Agenten übergebene Aufgabe wird in dieser Form beschrieben. Der Punkt ist nicht
die Form, sondern dass **Nicht-Ziele und Prüfbefehl mitgeliefert werden**:

```
# Aufgabe: <Name>

## Ziel            eine Zeile: was am Ende existiert
## Nicht-Ziele     was ausdrücklich NICHT getan wird (verhindert Scope-Drift)
## Randbedingungen welche Verträge nicht brechen dürfen
## Abnahme         objektives Kriterium
## Verifikation    ein ausführbarer Befehl
```

Ohne Nicht-Ziele weitet ein Agent den Auftrag aus. Ohne Verifikation meldet er „fertig",
ohne dass jemand es prüfen kann.

## 7. Verifikationsdisziplin

Die zentrale Regel des Repos: **Dass eine Datei existiert, ist kein Beweis; ein bestandener
Prüfbefehl ist einer.**

Sie entstand nicht aus einer Überzeugung, sondern aus einem Befund: In Phase 0 waren die
Häkchen für Woche 1 und 2 nach Dateiexistenz gesetzt — obwohl beide Wochen ihr eigenes Ziel
verfehlten. Das Projekt war in genau den Fehler gelaufen, gegen den es gebaut wurde.

Daraus folgen drei Gewohnheiten:

- **Einen Befund durch Ausführen prüfen, nicht durch Lesen.** In Phase 0 sah eine Hypothese
  beim Lesen des Codes richtig aus und erwies sich beim Ausführen als falsch.
- **Jede Phase endet an einem Tor, das ein Befehl entscheidet.** Die Tore sind im
  `projekt-doktor` verdrahtet: Prüfung 8 → T2.1, 9 → T1, 10 → T3, 11 → T4.
- **Geplantes Rot von echtem Ausfall trennen.** Die Baseline in `PRODUCT.md` §6.1 ist
  absichtlich rot. Der Doktor markiert diese Zeilen als „erwartet, wird in Phase N grün".

## 8. Was delegiert wird und was nicht

| Delegiert | Nicht delegiert |
|---|---|
| Recherche im Code, Messen, Ausführen | Die Entscheidung über den Umfang |
| Übersetzen, Umbenennen, mechanisches Umziehen | Das Schließen eines Themas |
| Dokumente aus vorhandenem Material schreiben | Ob ein Befund ein Defekt oder eine Absicht ist |
| Prüfbefehle bauen und laufen lassen | Commit und Push |

Der Agent schlägt vor und misst; der Mensch entscheidet und gibt frei. Deshalb steht in
`regeln.md` „Schritt für Schritt, nachfragen, nichts annehmen" — diese Regel entstand,
nachdem eine Sammelerzeugung von Dateien zweimal gestoppt wurde.
