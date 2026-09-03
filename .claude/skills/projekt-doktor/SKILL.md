---
name: projekt-doktor
description: Gesundheitscheck fuer agentic-starter. Gedaechtnis-Hook, .gehirn-Dateien, Abhaengigkeitsinstallation, Demo-Durchlauf, Tests, Dokumentkonsistenz und Risiko von Geheimnislecks werden in einer Tabelle berichtet. Bei "projekt doktor", "doktor", "gesundheitscheck", "ist alles in Ordnung", "sind die Phasen-Gates bestanden", "funktioniert das Gedaechtnis" verwenden, oder wenn der Verdacht besteht, dass ein Mechanismus still nicht mehr laeuft.
---

# Projekt-Doktor

Dieses Skill prüft die mechanische Schicht des Projekts: läuft die Gedächtnisinjektion, sind
die Abhängigkeiten intakt, sind die Phasen-Gates bestanden, stimmen die Dokumente mit der
Wirklichkeit überein, droht ein Geheimnis ins öffentliche Repo zu gelangen. Ziel ist es,
**stille Ausfälle sichtbar zu machen**.

Die zentrale Regel dieses Projekts lautet: *Dass eine Datei existiert, ist kein Beweis; ein
bestandener Prüfbefehl ist einer.* Dieses Skill ist die mechanische Form dieser Regel — es
bindet die Phasen-Gates an jeweils einen Befehl.

## Arbeitsweise

1. Arbeite im Repo-Stammverzeichnis (dort, wo `CLAUDE.md` liegt). Alle Pfade relativ,
   keine absoluten Pfade.
2. Führe die folgenden Prüfungen **der Reihe nach mit Bash aus**. Nimm die Befehle wie sie
   sind, rate nicht.
3. Stufe jede Ausgabe als 🟢 / 🟡 / 🔴 ein.
4. Gib das Ergebnis in **einer einzigen Tabelle** aus, mit einer Korrekturzeile je 🔴.
5. Schließe mit **einem einzigen Satz Urteil**.

Die Prüfungen sind nur lesend. Repariere nichts von selbst; berichte zuerst, korrigiere erst
auf Wunsch.

> **Phasenbewusstsein:** Prüfung 9 (T1) ist **seit Phase 2 grün** — ein 🔴 dort ist ab jetzt
> ein echter Ausfall, keine Baseline. Die Prüfungen 10 und 11 liefern bis zum Abschluss von
> Phase 3 ein 🔴. Das ist **erwartet**, kein Ausfall: die Baseline in `PRODUCT.md` §6.1 ist
> bewusst rot. Vermerk beim Berichten „Baseline, wird in Phase 3 grün".
>
> Die Ausführungsreihenfolge ist seit ADR-0024 **`2 → 3 → 5 → 4 → 6`**. Ein Vermerk
> „Phase 4" liegt damit **hinter** Phase 5, nicht davor.

---

## A. Gedächtnismechanik

### 1. Sind die Hook-Dateien vorhanden und ausführbar

```bash
for f in lib.sh session-start.sh; do p=".claude/hooks/$f"; if [ ! -f "$p" ]; then echo "$f: DATEI FEHLT"; elif [ ! -x "$p" ]; then echo "$f: NICHT ausfuehrbar"; else echo "$f: ok"; fi; done
```

🟢 beide `ok`. 🔴 fehlt oder nicht ausführbar.
Korrektur: `chmod +x .claude/hooks/*.sh`; fehlt die Datei, aus der Git-Historie zurückholen.

### 2. Ist der Hook in settings.json verdrahtet

```bash
node -e 'try{const s=require("./.claude/settings.json");const h=(s.hooks&&s.hooks.SessionStart)||[];const n=h.flatMap(m=>m.hooks||[]).filter(x=>String(x.command||"").includes("session-start.sh")).length;console.log("SessionStart-Verdrahtung:",n)}catch(e){console.log("settings.json: BESCHAEDIGT -",e.message)}'
```

🟢 `1`. 🔴 `0` (Hook läuft überhaupt nicht) oder JSON beschädigt.
Korrektur: den Block `hooks.SessionStart` in `.claude/settings.json` reparieren, Claude Code neu starten.

### 3. Läuft der Hook wirklich und liefert er gültiges JSON

Der Unterschied zu allen anderen Prüfungen: diese schaut nicht auf Dateiexistenz, sondern auf
**Verhalten**. Es ist die stärkste Prüfung der Liste.

```bash
CLAUDE_PROJECT_DIR="$PWD" ./.claude/hooks/session-start.sh 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const c=JSON.parse(s).hookSpecificOutput.additionalContext;console.log("hook: ok,",c.length,"Zeichen werden injiziert")}catch(e){console.log("hook: AUSGABE UNGUELTIG -",e.message)}})'
```

🟢 `ok` und Zeichenzahl unter 16000. 🔴 ungültige Ausgabe: der Hook injiziert still gar nichts,
das Gedächtnis wird also nie geladen.
Korrektur: mit `bash -x .claude/hooks/session-start.sh` nachverfolgen; prüfen, ob `node` im PATH liegt.

### 4. Gibt es eine Doppelverdrahtung

```bash
node -e 'const fs=require("fs");let n=0;for(const f of [".claude/settings.json",".claude/settings.local.json"]){if(!fs.existsSync(f))continue;let d;try{d=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){console.log(f+": BESCHAEDIGTES JSON");continue}for(const m of ((d.hooks||{}).SessionStart||[]))for(const h of (m.hooks||[]))if(String(h.command||"").includes("session-start.sh"))n++}console.log("SessionStart-Verdrahtungen gesamt:",n)'
```

🟢 genau `1`. 🔴 `2` oder mehr: das Gedächtnis wird pro Sitzung doppelt injiziert, der Kontext
bläht sich ohne Nutzen auf.
Korrektur: den Hook-Eintrag in `.claude/settings.local.json` löschen; andere Schlüssel wie
`permissions` unangetastet lassen.

---

## B. Gedächtnisinhalt

### 5. Sind die `.gehirn/`-Dateien vorhanden

```bash
for f in kern.md regeln.md themen.md letzte-sitzung.md; do if [ -f ".gehirn/$f" ]; then echo "$f: da ($(wc -l < ".gehirn/$f" | tr -d ' ') Zeilen)"; else echo "$f: FEHLT"; fi; done
```

🟢 alle vier vorhanden. 🟡 nur `letzte-sitzung.md` fehlt — bei einem frischen Klon normal
(gitignoriert). 🔴 `kern.md`, `regeln.md` oder `themen.md` fehlt: die dauerhafte Schicht des
Gedächtnisses ist weg.
Korrektur: aus der Git-Historie zurückholen. `letzte-sitzung.md` wird am Ende der nächsten
Sitzung neu geschrieben.

### 6. Ist das Injektionsbudget überschritten

```bash
rw=$(sed -n '1,60p' .gehirn/regeln.md 2>/dev/null | grep -c '^- \*\*Regel:\*\*'); rt=$(grep -c '^- \*\*Regel:\*\*' .gehirn/regeln.md 2>/dev/null); th=$(sed -n '/^## Aktive/,/^## Abgeschlossene/p' .gehirn/themen.md 2>/dev/null | grep -c '^### Thema:'); tot=$(CLAUDE_PROJECT_DIR="$PWD" ./.claude/hooks/session-start.sh 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).hookSpecificOutput.additionalContext.length))}catch(e){process.stdout.write("0")}})'); echo "Regeln: $rw/$rt im Fenster | aktive Themen: $th | gesamt: $tot/16000"
```

🟢 alle Regeln im Fenster, aktive Themen ≤ 6, gesamt < 10000.
🟡 gesamt zwischen 10000 und 16000, oder 7–8 aktive Themen.
🔴 ein Teil der Regeln liegt außerhalb der ersten 60 Zeilen (wird still nie geladen), oder
mehr als 8 aktive Themen.
Korrektur: in `regeln.md` die nützlichsten Regeln nach oben schieben, überholte löschen.
In `themen.md` abgeschlossene Themen nach `## Abgeschlossene Themen` verschieben.

### 7. Aktualität von `letzte-sitzung.md`

```bash
f=".gehirn/letzte-sitzung.md"; if [ -f "$f" ]; then m=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null); n=$(date +%s); echo "letzte-sitzung: vor $(( (n-m)/3600 )) Stunden aktualisiert"; else echo "letzte-sitzung: FEHLT (bei frischem Klon normal)"; fi
```

🟢 in den letzten 48 Stunden. 🟡 48–168 Stunden. 🔴 älter als 168 Stunden: Sitzungen enden
ohne Spur, die Übergaberegel greift nicht.
Korrektur: `CLAUDE.md` > Gedächtnisprotokoll anwenden; am Sitzungsende den obersten Block
aktualisieren.

---

## C. Projektgesundheit — die Phasen-Gates

### 8. Sind node und die Abhängigkeitsinstallation intakt

Nur auf das Vorhandensein von `node_modules` zu schauen reicht nicht: durch ein fehlendes
eingebettetes Modul kann die Installation still beschädigt sein. Deshalb wird der Graph
tatsächlich **importiert**.

```bash
command -v node >/dev/null 2>&1 && echo "node: $(node -v)" || echo "node: FEHLT"; if [ -d node_modules ]; then node --input-type=module -e 'await import("./src/kernel/graph/build.js"); console.log("Abhaengigkeiten: aufloesbar")' 2>&1 | tail -1; else echo "Abhaengigkeiten: node_modules FEHLT"; fi
```

🟢 `Abhaengigkeiten: aufloesbar`. 🔴 `ERR_MODULE_NOT_FOUND` oder Ähnliches: Installation unvollständig.
Korrektur (**Gate T2.1**): `node_modules` und `package-lock.json` löschen, `npm install` erneut ausführen.

> ⚠️ **Bekannte Grenze dieser Prüfung:** sie prüft die *bestehende* Installation, nicht ob eine
> *frische* Installation intakt wäre. Wurde `node_modules` von Hand repariert, meldet sie Grün,
> obwohl `package-lock.json` weiterhin einen kaputten Baum erzeugen kann. Die Garantie für die
> frische Installation gibt es erst in CI — minimal ab **Phase 3** (ADR-0024) auf einem
> sauberen Runner.

### 9. Läuft `npm run demo` durch — **Kriterium T1**

```bash
if timeout 120 npm run demo >/dev/null 2>&1; then echo "demo: BESTANDEN"; else echo "demo: FEHLGESCHLAGEN"; fi
```

🟢 `BESTANDEN`. 🔴 `FEHLGESCHLAGEN`.
Seit **Gate T2.2** grün (Exit 0, Endstatus `PUBLISHED`). Ein 🔴 hier ist deshalb **kein**
Baseline-Rot mehr, sondern eine Regression: die Baseline in `PRODUCT.md` §6.1 nennt als
ursprüngliche Ursache eine nicht schließende Revisionsschleife (`GraphRecursionError`).

### 10. Testinfrastruktur — **Kriterium T3**

```bash
node -e 'const s=require("./package.json").scripts||{};console.log("test-Skript:",s.test?"da":"FEHLT")'; echo "Testdateien: $(find tests -name '*.test.js' 2>/dev/null | wc -l | tr -d ' ')"
```

🟢 Skript vorhanden und mindestens eine Testdatei. 🔴 beides fehlt.
Seit **T3.1** grün: `npm test` läuft über `tests/**/*.test.js` mit `node:test`, ohne neue
Abhängigkeit. Ein 🔴 hier ist deshalb kein Baseline-Rot mehr, sondern eine Regression.

### 11. Evaluations-Harness — **Kriterium T4**

```bash
node -e 'const s=require("./package.json").scripts||{};console.log("evals-Skript:",s.evals?"da":"FEHLT")'; echo "Dateien in evals/: $(find evals -type f 2>/dev/null | wc -l | tr -d ' ')"
```

🟢 Skript vorhanden, Datensatz und Runner da. 🔴 fehlt.
Seit **T3.3** grün: `npm run evals` läuft über `evals/runners/policy.js`, 20 Aufgaben, Mock.
Ein 🔴 hier ist kein Baseline-Rot mehr, sondern eine Regression. Der Judge-Teil der Schicht B
(`evals:quality`, 30 Etiketten) gehört seit ADR-0024 in **Phase 4** — sein Fehlen ist bis
dahin erwartet.

---

## D. Repo-Hygiene

### 12. Phase-1-Dokumente und Konsistenz des Wegweisers

```bash
for f in PRODUCT.md ARCHITECTURE.md EVALS.md DECISIONS.md docs/workflow.md docs/security-model.md docs/development-process.md; do [ -f "$f" ] && echo "$f: da" || echo "$f: fehlt"; done; echo "--- veraltete Markierungen ---"; grep -oE '`[^`]+` ⏳' CLAUDE.md 2>/dev/null | sed 's/` ⏳//; s/`//' | while read -r p; do if [ -d "$p" ]; then n=$(find "$p" -type f 2>/dev/null | wc -l | tr -d ' '); [ "$n" -gt 0 ] && echo "VERALTET: $p enthaelt $n Dateien, ist aber ⏳ markiert"; elif [ -f "$p" ]; then echo "VERALTET: $p existiert, ist aber ⏳ markiert"; fi; done; echo "(leer heisst: Markierungen aktuell)"
```

Für Verzeichnisse ist das Kriterium **nicht Existenz, sondern Inhalt**: ein `tests/`, das nur
leere Unterordner enthält, ist nicht bereit — Git verfolgt es ohnehin nicht und beim Klon ist
es unsichtbar. Für Dateien genügt die Existenz.

🟢 keine veraltete Markierung. 🟡 einige Dokumente fehlen, aber alle sind `⏳` markiert.
🔴 eine existierende Datei (oder ein gefülltes Verzeichnis) ist noch `⏳` markiert: die
Wegweiser-Tabelle in `CLAUDE.md` beschreibt die Wirklichkeit falsch.
Korrektur: die betreffende `⏳`-Markierung aus der Tabelle in `CLAUDE.md` entfernen.

### 13. Git-Zustand

```bash
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "git: da, $(git status --porcelain | wc -l | tr -d ' ') Dateien nicht committet"; else echo "git: KEIN REPO"; fi
```

🟢 Repo vorhanden, weniger als 20 nicht committete Dateien. 🟡 mehr als 20 angesammelt.
🔴 kein Repo.
Korrektur: Angesammeltes in logische Teile zerlegen und committen.

### 14. Risiko von Geheimnislecks

Das Repo soll öffentlich werden; deshalb ist diese Prüfung kritisch.

```bash
git ls-files 2>/dev/null | grep -E '(^|/)\.env$|settings\.local\.json|\.pem$|\.key$' || echo "keine verfolgte Geheimnisdatei"; echo "--- Restdateien ---"; find . -path ./.git -prune -o -path ./node_modules -prune -o -type f \( -name '*.bak' -o -name '*.orig' -o -name 'settings.local.json.*' \) -print 2>/dev/null | head -5; echo "(leer heisst: sauber)"
```

🟢 beide Abschnitte sauber. 🔴 taucht eine von Git verfolgte Geheimnisdatei auf, liegt der
Schlüssel bereits in der Historie.
Korrektur: `git rm --cached <Datei>`, die `.gitignore`-Regel prüfen, und den geleakten
Schlüssel beim Anbieter **widerrufen und neu ausstellen**. Steckt er in der Historie, ist eine
Historienbereinigung nötig.

---

## Berichtsformat

Nach allen Prüfungen genau eine Tabelle ausgeben:

```
| Prüfung | Status | Befund |
| --- | --- | --- |
| Hook-Dateien | 🟢 | beide vorhanden und ausführbar |
| settings.json-Verdrahtung | 🟢 | SessionStart verdrahtet |
| Hook-Livetest | 🟢 | injiziert 6860 Zeichen |
| Doppelverdrahtung | 🟢 | eine Verdrahtung |
| .gehirn-Dateien | 🟢 | alle vier vorhanden |
| Injektionsbudget | 🟢 | 7/7 Regeln im Fenster, 5 Themen, 6860/16000 |
| Aktualität letzte-sitzung | 🟢 | vor 2 Stunden |
| Abhängigkeitsinstallation | 🟢 | auflösbar (lokal repariert) |
| npm run demo | 🔴 | fehlgeschlagen (Baseline, Phase 2) |
| Testinfrastruktur | 🔴 | Skript und Tests fehlen (Baseline, Phase 3) |
| Evaluations-Harness | 🔴 | nicht aufgebaut (Baseline, Phase 3) |
| Dokumentkonsistenz | 🟡 | 6 Dokumente fehlen, alle ⏳ markiert |
| Git | 🟢 | Repo vorhanden, 7 Dateien nicht committet |
| Geheimnislecks | 🟢 | sauber |
```

Nach der Tabelle für jede 🔴-Zeile eine Zeile, die mit „Korrektur:" beginnt, samt Befehl.
Gruppiere die aus der Baseline stammenden 🔴 getrennt und markiere sie mit „erwartet, wird in
Phase N grün" — verwechsle einen echten Ausfall nicht mit geplantem Rot.

Danach ein einziger Satz Urteil. Beispiel: *„Die Gedächtnisschicht ist gesund; alle roten
Punkte sind bekannte Baseline, der einzige echte Ausfall liegt in der Abhängigkeitsinstallation."*
Ist alles grün, fällt auch das Urteil kurz aus: *„Projekt gesund, nichts zu tun."*
