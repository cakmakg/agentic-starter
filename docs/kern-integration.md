# Kern-Integration — agentic-starter auf dem Security Core

> Der lebende Plan der Integration. Dieses Dokument ist aktuell, nicht der Planungstext,
> aus dem es entstand. Entscheidungen stehen in `DECISIONS.md` (ADR-0031); hier stehen
> Stufen, Kriterien, Stand und Nachweise.

**Gepinnter Kern:** `adapter-seam-v1` = `157bdad8583b4a494643103ed9fcef8e89fe3b53`
(`https://github.com/cakmakg/AISecuritySystem.git`) · **Zuletzt aktualisiert:** 2026-10-25

Der Pin ändert sich nur durch ein neues ADR (CC-2). Ausführlich wird nur die laufende und
die nächste Stufe beschrieben; spätere stehen als eine Zeile — früh geschriebene Details
veralten.

**Vorgehen** (Vorgabe der Nutzerin oder des Nutzers, 2026-10-25): erst der Plan, dann der
Code; der Code auf der einfachsten Stufe, die die Verbindung trägt. Jede Stufe wird zuerst
in ihrer minimalen Form gebaut, **geprüft und getestet** — erst dann folgt die nächste.
Einzelheiten bauen auf einer geprüften Grundlage auf, nicht daneben. Einzelheiten dieses
Plans stehen nur hier; `DECISIONS.md` trägt die Entscheidungen.

---

## 1. Stufen

| Stufe | Ziel in einem Satz | Vorbedingung im Kern | Stand | Nachweis |
|---|---|---|---|---|
| **1 · Scheinportal** | Ein genehmigtes Inserat gelangt über den Kern in ein Scheinportal; der Schlüssel bleibt auf der Vertrauensseite | keine — `adapter-seam-v1` | in Arbeit — Teil 1 erledigt | ADR-0031 |
| 2 · Echtes Portal | Ein echtes Portal (Sandbox-Konto) über denselben Adapterweg | keine | geplant — nächste | — |
| 3 · Agent in der Domäne | Der Graph läuft in der Domäne des Launchers | Tag für Modellzugang (Q-26) | geplant | — |
| 4 · Richtlinie | Das Produkt sagt per Konfiguration, welche Aktionen und Portale erlaubt sind | Tag für Richtlinie (Q-06, AD-09) | geplant | — |
| 5 · Audit | Jeder Ausführungsversuch erzeugt ein Ereignis, das Produkt zeigt es | Tag für Audit (Q-13) | geplant | — |
| 6 · Sicherheitsfreigabe | Die Freigabe für `publish_listing` kommt von außerhalb des Agenten | Tag für TB-3 (Q-09, Q-20) | geplant | — |

Eine Stufe mit Vorbedingung beginnt erst, wenn der Kern die Fähigkeit unter einem Tag
belegt. Der Kern nennt kein Produkt (CC-1); ein Bedarf dieses Repos wird in der
Kern-Sitzung als allgemeiner Punkt behandelt (CC-10).

## 2. Stufe 1 — Scheinportal (laufend)

**Ziel.** Ein genehmigtes Inserat wird von agentic-starter **über den Security Core** in ein
**Scheinportal** veröffentlicht. Der Portalschlüssel liegt nur auf der Vertrauensseite.
Eine abgelehnte Anfrage veröffentlicht nichts.

```
immobilien-Graph (Mock-LLM) → human_approval → delivery → ActionQueue
  → Worker → TB-1-Client ──(Unix-Socket / Named Pipe)──▶ Security Core
  → Tool Adapter publish_listing (Schlüssel hier) → Scheinportal
```

### 2.1 Abnahmekriterien

Jedes Kriterium entscheidet ein Befehl; dass eine Datei existiert, ist kein Nachweis.

**Statuswerte:** `geplant` · `in Arbeit` · `erledigt`. Ein Test, der noch nicht geschrieben
ist, steht als `geplant` — nicht als vorhanden. `erledigt` gilt erst, wenn der Prüfbefehl
durchläuft; daneben stehen der Commit und der Befehl.

| # | Kriterium | Stand | Nachweis |
|---|---|---|---|
| M1 | `npm test` grün, Abdeckungsschwelle 80 % inklusive | geplant | — |
| M2 | Lauf mit drei Prozessen: das genehmigte Inserat steht im Scheinportal, Queue-Status `DONE` mit `listingId` | geplant | — |
| M3 | Ungültige Argumente (unbekanntes Portal, leerer Text, Text mit Steuerzeichen über 16 KiB — Mehrbyte-Text allein erreicht die Grenze nie, ADR-0031 Teil 5) → Kern `rejected` → Queue `REJECTED`, kein Eintrag im Portal | geplant | — |
| M4 | Kern nicht erreichbar → `failed` → Queue `FAILED`, keine automatische Wiederholung, kein Eintrag im Portal; Absturz während des Aufrufs → beim Abspielen `FAILED` | geplant | — |
| M5 | Portalschlüssel nicht im Code und nicht in der Umgebung von agentic-starter (geplanter Strukturtest, Teil 4); nicht lesbar und das Portal nicht erreichbar für den Benutzer von agentic-starter (geplanter WSL2-Lauf, Teil 5) | geplant | — |
| M6 | Benutzter Kern ist `157bdad…` und unverändert (Test, Teil 2) | erledigt (2026-10-25) | `e19a77c` · `node --test tests/kernPin.test.js` 5/5; Gegenproben: geänderte Datei im Submodul und Checkout von `3d56872` → je genau ein Test rot |

### 2.2 Teile

Je Teil eine Aufgabe nach der Vorlage in `docs/development-process.md` §6; je Änderung ein
Defekt. Nach Teil 1, 3 und 5 ist ein Kontrollpunkt in der Kern-Sitzung (CC-1 – CC-10).

| Teil | Inhalt | Geplanter Prüfbefehl | Stand | Nachweis |
|---|---|---|---|---|
| 1 | ADR-0031 · dieses Dokument | Freigabe durch die Nutzerin oder den Nutzer | erledigt — beide freigegeben (2026-10-25); Kontrollpunkt der Kern-Sitzung auf Wunsch entfallen | ADR: `e56422f` · dieses Dokument: Commit „docs(kern-integration): …" |
| 2 | Submodul `vendor/security-core` auf `157bdad…` · `--test-coverage-exclude="vendor/**"` · CI `submodules: true` · `engines.node >= 24` | Test: Gitlink und HEAD = Hash, `git status --porcelain` leer, `start.ts` exportiert `startSecurityCore`; Gegenprobe: eine Datei im Submodul geändert → rot | erledigt (2026-10-25) | `e19a77c` · `npm test` 134/134, Zeilenabdeckung 92,10 % (unverändert, `vendor/` ausgeschlossen) · `npm ci --dry-run` Exit 0 |
| 3a | Scheinportal: Socket/Named Pipe, nur `Authorization: Bearer <Schlüssel>`, `POST /listings` → `{listingId}`, schlüsselgeschützter Lese-Endpunkt nur für den Operator | eigene Tests | erledigt (2026-10-25) | `0992d91` · `node --test tests/fakePortal.test.js` 7/7; Gegenprobe: Schlüsselprüfung ausgeschaltet → die zwei 401-Tests rot |
| 3b | `publish_listing`: Argumente genau `{portal, text}`, bekanntes Portal, 1–5000 UTF-16-Einheiten; `execute` prüft erneut, nur `POST /listings`, erwartet `200`, gibt nur `listingId` zurück, feste Fehlertexte; Schlüssellesen fail-closed mit `ConfigError` | Tests nach CC-6: ungültig abgelehnt · genau eine Anfrage, nur an `/listings` · nur `listingId` im Ergebnis · kaputte Portalantwort ohne Leck · Testschlüssel nie in Fehlern, stdout/stderr, Ergebnissen | erledigt (2026-10-25) | `291fd3f` · `node --test tests/publishListing.test.js` 16/16 (dreimal); `npm test` 157/157, Zeilenabdeckung 92,64 %; Gegenprobe: Schlüssel im Fehlertext → Leck-Test rot |
| 4a | **Die Verbindung allein, ohne Queue und ohne Kernel** (§2.3): TB-1-Client `src/adapters/security-core/client.js` · Einstieg der Vertrauensseite `src/bin/securityCore.js` | Client-Test gegen einen Test-Socket · Verbindungstest mit Portal und Kern als Kindprozesse (beide geplant) | geplant | — |
| 4b | `src/kernel/` (§2.3) — vier Aufgaben, vier Commits: Executor an `startActionWorker` · Abbildung `executed/rejected/failed` → `DONE/REJECTED/FAILED` · Wegfall der Wiederholung · `PROCESSING` ins Log, beim Abspielen `FAILED` · **im selben Commit wie der Code:** `EXTEND.md` §6 (keine 3 Versuche, kein `TenantConfig`-Schlüssel) und `ARCHITECTURE.md` §4 (Zeile „`PROCESSING` wandert bewusst NICHT ins Log") | `npm test`; Bericht der Schicht A beider Domänen zeichengleich bis auf den Zeitstempel | geplant | — |
| 4c | **Zusammensetzen — das MVP** (§2.3): Kernname in `domains/immobilien/actions.js` · Executor und Worker in `bin/demoImmobilien.js` · **im selben Commit wie der Code:** `docs/security-model.md` §7 („Echte Executor bleiben außerhalb von v1") und Abb. 5, `ARCHITECTURE.md` §4 (Zeile „Action-Executor simuliert") und §6, README | MVP-Test mit drei Prozessen (M2–M4 über die Queue) · Strukturtest der Vertrauenslinie (M5, Code) · Lauf in drei Terminals durch die Nutzerin oder den Nutzer (alle geplant) | geplant | — |
| 5 | **WSL2-Lauf** (§2.4) · **Vorbedingungen:** CI auf Ubuntu grün · Fehlerhandler des Scheinportals (Befund F2a im Kern, P-20) · eigene, wegwerfbare Distribution (nicht `mc-evidence`) | Prüfungen C1–C6 mit vier Gegenproben; Ergebnisse in `nachweis/<datum>-wsl2/` (geplant) | geplant | — |

Nach Teil 4 **läuft das MVP lokal** — das ist noch keine Trennungsaussage.

**Bei Teil 3 entschieden:** das Portal hält nur den SHA-256-Hash des Schlüssels
(`PORTAL_CREDENTIAL_HASH_FILE`, ADR-0031 Nachtrag) — sonst wäre der Schlüssel auch für den
Benutzer des Portals lesbar.

### 2.3 Teil 4 im Einzelnen — erst die Verbindung, dann die Queue, dann das Zusammensetzen

Jeder Schritt baut auf dem geprüften vorigen auf (Vorgehen oben). Jede Datei wird vor dem
Schreiben im Chat gezeigt (`.gehirn/regeln.md`).

**4a — die Verbindung allein.** Kernel und Queue bleiben unberührt.

- `src/adapters/security-core/client.js`: importiert nur `node:*`. Eine Anfrage je
  Verbindung (`agent: false`), Körper genau `{action, arguments}`. Feste Zeitgrenze 10 s —
  länger als die 5 s des Adapters, denn der Kern selbst begrenzt die Ausführung nicht. Wirft
  nie. Deutet so streng wie `interpretOutcome` im Kern: nur ein wohlgeformtes `rejected`
  heißt „keine Wirkung", alles andere ist `failed`.
- `src/bin/securityCore.js`: `startSecurityCore(() => [publishListing])`; liest
  `PORTAL_SOCKET` und `PORTAL_CREDENTIAL_FILE` fail-closed.
- Test `tests/securityCoreClient.test.js`: ein Test-Socket antwortet kaputt — Zusatzfeld,
  kein JSON, keine Antwort, Verbindung abgelehnt → jedes Mal `failed`, nie eine Ausnahme.
- Test `tests/integration/kernVerbindung.test.js`: Portal und Kern als Kindprozesse, über den
  Client: gültig → `executed`, Inserat beim Portal · unbekanntes Portal und Steuerzeichen-Text
  über 16 KiB → `rejected`, kein Eintrag · Kern gestoppt → `failed` · Kern ohne
  Schlüsseldatei → Exit 1 mit festem Text, kein Schlüssel in der Ausgabe.
- **Abnahme:** `npm test` grün. Die Kette Client → Kern → Adapter → Portal ist zum ersten
  Mal Ende zu Ende belegt — M2–M4 auf der Ebene von TB-1, noch ohne Queue.

**4b — die Queue im Kernel.** Vier Commits, jeder mit eigenem Test:

1. `startActionWorker({ executor, intervalMs })` ist Pflicht; `report` gibt einen
   ausdrücklichen Simulations-Executor; die Aufrufer (`serve.js`, Tests, Harness) werden
   angepasst.
2. Abbildung `executed`/`rejected`/`failed` → `DONE`/`REJECTED`/`FAILED`; `listingId` bzw.
   `reason` ins Log.
3. Keine Wiederholung; im selben Commit `EXTEND.md` §6.
4. `PROCESSING` ins Log, beim Abspielen `FAILED`; im selben Commit `ARCHITECTURE.md` §4.
   Test: eine zweite Queue mit demselben Log liest die Aktion als `FAILED`.

- **Abnahme:** je Commit `npm test` grün; `npm run evals` liefert für beide Domänen
  denselben Bericht wie am 2026-09-07, bis auf den Zeitstempel.

**4c — Zusammensetzen: das MVP.**

- `domains/immobilien/actions.js` erklärt den Kernnamen: `PUBLISH_LISTING` →
  `publish_listing`.
- `bin/demoImmobilien.js` setzt den Executor aus Client und `SECURITY_CORE_SOCKET`
  zusammen, wartet, bis jede Aktion `DONE`, `REJECTED` oder `FAILED` ist, und gibt Status und
  `listingId` aus. Exit 0 nur, wenn alle `DONE` sind. **Fehlt `SECURITY_CORE_SOCKET`, endet
  es vor allem anderen mit Exit 1 und festem Text** (entschieden 2026-10-25: ein Demo, das
  Aktionen still auf `PENDING` liegen lässt, täuscht einen Lauf vor).
- Test `tests/integration/mvp.test.js` mit drei Prozessen: drei Inserate `DONE`, drei
  Einträge im Portal (M2) · Steuerzeichen-Text über die Queue → `REJECTED`, kein Eintrag (M3)
  · Kern gestoppt → `FAILED`, auch nach weiteren Takten (M4).
- Test `tests/vertrauenslinie.test.js`: alle Importe unter `src/` in beide Richtungen gegen
  die Tabelle in `ARCHITECTURE.md` §6; auf der Agentenseite kein Wert der Form `asp_` + 64
  Hex und kein `PORTAL_*` (M5, Code).
- Im selben Commit wie der Code: `docs/security-model.md` §7 und Abb. 5, `ARCHITECTURE.md`
  §4 (Zeile „Action-Executor simuliert") und §6 (Baum), README.
- Lauf in drei PowerShell-Terminals: die Befehle Schritt für Schritt mit erwarteter Ausgabe
  (Schlüssel und Hash erzeugen, Portal, Kern, Demo); die Nutzerin oder der Nutzer führt aus.
- **Abnahme:** M1–M4 und der Code-Teil von M5 `erledigt`; die lokale Aussage aus §2.6 darf
  geschrieben werden.

### 2.4 Teil 5 im Einzelnen — der WSL2-Lauf

**Vorbedingungen — ohne alle drei beginnt Teil 5 nicht:**

1. CI auf Ubuntu grün — der erste echte Lauf des Unix-Socket-Pfads; lokal läuft nur die
   Named Pipe, und der Unix-Zweig von `fakePortal.js` ist ungedeckt.
2. Fehlerhandler des Scheinportals für den laufenden Server, wie `keepServing` im Kern, mit
   Test: ein abgestürztes Portal gäbe seinen Socket-Pfad frei (Befund F2a), und P-20 hängt
   daran.
3. Eine neue, wegwerfbare Distribution — **nicht** `mc-evidence` — in der Konfiguration der
   Nachweisumgebung des Kerns: Interop aus, automatisch eingehängte Laufwerke aus, Docker
   Desktop gestoppt, Node 24. Interop aus ist Pflicht: mit Interop startet der Benutzer von
   agentic-starter Windows-Programme und kommt an den Dateirechten der Distribution vorbei
   (im Kern MA-2, Bedingung f).

**Skript** `nachweis/wsl2/pruefen.sh`, als root — es handelt als Operator.
`minimal-core/deploy/linux/evidence.sh` im Kern ist Vorbild zum Lesen, keine Kopiervorlage.

- Benutzer `as-agent`, `as-core`, `as-portal`.
- Gruppen: `as-core-clients` (Mitglied nur `as-agent`, darf den Kern-Socket öffnen) ·
  `as-portal-clients` (Mitglied nur `as-core`, darf den Portal-Socket öffnen).
- Verzeichnisse: `/opt/agentic-starter` gehört root und ist für den Agenten nicht schreibbar
  (S2) · `/run/as-core` mit `2750 as-core:as-core-clients` · `/run/as-portal` mit
  `2750 as-portal:as-portal-clients`.
- Schlüssel `/etc/as-core/portal.key` (`as-core`, `0400`) · Hash
  `/etc/as-portal/portal.hash` (`as-portal`, `0400`).
- Prozesse über `runuser` mit leerer Umgebung (`env -i`), nur die Variablen aus ADR-0031
  Teil 3.

| # | Prüfung |
|---|---|
| C1 | Demo als `as-agent`: drei `DONE`, drei Einträge im Portal |
| C2 | `/proc/<pid>/environ` des Agenten enthält kein `asp_` und kein `PORTAL_*` |
| C3 | `as-agent` liest weder die Schlüssel- noch die Hash-Datei |
| C4 | `as-agent` öffnet den Portal-Socket nicht |
| C5 | `as-agent` schreibt nicht ins Installationsverzeichnis |
| C6 | Kern gestoppt → `FAILED`, kein neuer Eintrag im Portal |

**Gegenproben** — jede muss genau ihre Prüfung rot machen: Schlüsseldatei `0444` → C3 ·
`as-agent` in `as-portal-clients` → C4 · Schlüssel in der Umgebung des Agenten → C2 ·
Installationsverzeichnis schreibbar → C5.

**Lauf:** die Nutzerin oder der Nutzer startet das Skript im eigenen Terminal; die Ergebnisse
landen in `nachweis/<datum>-wsl2/`. Danach: Stand und Nachweis in §2.2, die WSL2-Aussage aus
§2.6, Kontrollpunkt der Kern-Sitzung.

**Offen (D2):** aus welchem Root-Dateisystem die neue Distribution entsteht.
`AiSecuritySystem/wslmc-rootfs.tar` liegt vor; sein Inhalt ist nicht geprüft.

### 2.5 Bekannte Grenzen

- Doppelte Veröffentlichung nur nicht mehr automatisch: ein `FAILED`, das in Wahrheit gewirkt
  hat und von einem Menschen neu eingereiht wird, ergibt ein zweites Inserat (Stufe 2
  schließt das).
- Ein Verbindungsfehler vor dem Senden ergibt `FAILED`, obwohl nichts gesendet wurde.
- Der lokale Lauf unter Windows belegt Funktion, nicht Trennung (ein Benutzer, Named Pipes).
- HITL ist eine Inhaltsfreigabe, kein Sicherheitstor: wer den Kern-Socket öffnen kann,
  veröffentlicht ohne Freigabe.

### 2.6 Erlaubte Aussage (CC-9)

- **Nach Teil 4 (lokal):** „Der Veröffentlichungsweg im Code führt über den Kern; im Code
  und in der Umgebung von agentic-starter steht kein Portalschlüssel."
- **Nach Teil 5 (WSL2):** „`PUBLISH_LISTING` erreicht das Scheinportal nur über den
  Security Core (`adapter-seam-v1`, unverändert); der Portalschlüssel ist nur für den
  Benutzer des Kerns lesbar, und der Benutzer von agentic-starter erreicht das Portal nicht
  direkt."
- **Nicht:** die Aussagen des Kerns (CC-3) — der Agent läuft nicht in der Domäne des
  Launchers (CC-7); keine Richtlinie, keine Sicherheitsfreigabe, kein Audit, keine Identität.

## 3. Stufe 2 — Echtes Portal (nächste)

**Ziel.** Ein echtes Portal (Sandbox-Konto) wird über denselben Adapterweg angesprochen.
**Vorbedingung im Kern:** keine; die Adapternaht genügt.

**Abnahmekriterien (Entwurf).**

- Q-22, Q-25 und P-20 sind für dieses Portal schriftlich beantwortet und, wo möglich, geprüft.
- Ein Idempotenzschlüssel, den das Portal selbst kennt, schließt die Grenze „ein als
  `FAILED` markierter, aber erfolgter Aufruf kann ein zweites Inserat ergeben".
- M1–M6 aus Stufe 1 gelten weiter, mit dem echten Portal statt des Scheinportals.

**Offene Fragen.** Liegen API und Vertrag des Portals vor (`docs/kundenerkundung-immobilien.md`
§5)? Erlaubt die Sandbox einen Lauf ohne Veröffentlichung nach außen?

## 4. Änderungsprotokoll

| Datum | Was | Warum |
|---|---|---|
| 2026-10-25 | Dokument angelegt aus dem Planungstext (§1, §7, §8), angepasst an ADR-0031 | Der Plan der Integration lebt im Repo, nicht in einem fremden Text |
| 2026-10-25 | Noch nicht geschriebene Tests und Kriterien als `geplant` markiert, Statuswerte festgelegt | Ein geplanter Test darf nicht wie ein vorhandener aussehen; `erledigt` nur mit Commit und Prüfbefehl |
| 2026-10-25 | Teil 2 und M6 erledigt | Submodul gepinnt (`e19a77c`); Pin-Test und zwei Gegenproben ausgeführt |
| 2026-10-25 | Teil 3a und 3b erledigt; Schlüsselprüfung des Portals über den Hash | Scheinportal (`0992d91`) und Adapter (`291fd3f`) mit Tests und Gegenproben; Hash statt gemeinsamer Datei hält die Aussage aus Teil 10 wahr |
| 2026-10-25 | M3 berichtigt: Steuerzeichen statt Mehrbyte-Text; 3b zählt UTF-16-Einheiten | Mehrbyte-Text unter 5000 Einheiten bleibt unter 16 KiB (gemessen) — der alte Fall hätte Tor 2 geprüft, nicht den Kern |
| 2026-10-25 | Abschnitt „Vorgehen"; Dokumentkorrekturen aus ADR-0031 an 4b und 4c gebunden; Fehlerhandler des Portals als Vorbedingung von Teil 5 | Vorgabe: erst die minimale Grundlage prüfen, dann aufbauen. Was nur zusammen mit Code wahr wird, ändert sich im selben Commit wie der Code |
| 2026-10-25 | Plan für Teil 4 und 5 im Einzelnen (§2.3, §2.4): 4a nur die Verbindung, 4b die Queue, 4c das Zusammensetzen; Vorbedingungen und Prüfungen C1–C6 für den WSL2-Lauf; `bin/securityCore.js` von 4c nach 4a; Demo ohne `SECURITY_CORE_SOCKET` → Exit 1; Skripte unter `nachweis/wsl2/`; D2 offen | Freigabe des Plans. Die Verbindung wird allein geprüft, bevor Kernel und Queue sie benutzen |
