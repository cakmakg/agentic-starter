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
| 4a | TB-1-Client: eine Anfrage je Verbindung, Körper genau `{action, arguments}`, feste Zeitgrenze, wirft nie, strenge Deutung, domänenfrei | Unit-Tests gegen einen Test-Socket (geplant) | geplant | — |
| 4b | `src/kernel/` — vier Aufgaben, vier Commits: Executor an `startActionWorker` · Abbildung `executed/rejected/failed` → `DONE/REJECTED/FAILED` · Wegfall der Wiederholung · `PROCESSING` ins Log, beim Abspielen `FAILED` · **im selben Commit wie der Code:** `EXTEND.md` §6 (keine 3 Versuche, kein `TenantConfig`-Schlüssel) und `ARCHITECTURE.md` §4 (Zeile „`PROCESSING` wandert bewusst NICHT ins Log") | `npm test`; Bericht der Schicht A beider Domänen zeichengleich bis auf den Zeitstempel | geplant | — |
| 4c | Verdrahtung in `src/bin/` · `bin/securityCore.js` mit `startSecurityCore(() => [publishListing])` · Worker in `demoImmobilien.js` · **im selben Commit wie der Code:** `docs/security-model.md` §7 („Echte Executor bleiben außerhalb von v1") und Abb. 5, `ARCHITECTURE.md` §4 (Zeile „Action-Executor simuliert") | Integrationstest (geplant; Portal und Kern als Kindprozesse) für M2–M4 · Strukturtest der Importe (geplant) in beide Richtungen (M5, Code) · Lauf in drei Terminals | geplant | — |
| 5 | WSL2-Lauf: eigene Distribution (nicht `mc-evidence`), drei OS-Benutzer, Socket-Verzeichnisse und Schlüsseldatei nach ADR-0031, Installationsverzeichnis für den Agenten nicht schreibbar (S2) · **Vorbedingung:** das Scheinportal bekommt einen Fehlerhandler für den laufenden Server wie `keepServing` im Kern — ein abgestürztes Portal gäbe seinen Socket-Pfad frei (Befund F2a im Kern), und P-20 hängt daran | Prüfungen (geplant): Schlüssel nicht in `/proc/<pid>/environ` von agentic-starter, Schlüsseldatei nicht lesbar, Portal-Socket nicht erreichbar, Veröffentlichung nur über den Kern; Ergebnisse in einem datierten Nachweisordner | geplant | — |

Nach Teil 4 **läuft das MVP lokal** — das ist noch keine Trennungsaussage.

**Bei Teil 3 entschieden:** das Portal hält nur den SHA-256-Hash des Schlüssels
(`PORTAL_CREDENTIAL_HASH_FILE`, ADR-0031 Nachtrag) — sonst wäre der Schlüssel auch für den
Benutzer des Portals lesbar.

### 2.3 Bekannte Grenzen

- Doppelte Veröffentlichung nur nicht mehr automatisch: ein `FAILED`, das in Wahrheit gewirkt
  hat und von einem Menschen neu eingereiht wird, ergibt ein zweites Inserat (Stufe 2
  schließt das).
- Ein Verbindungsfehler vor dem Senden ergibt `FAILED`, obwohl nichts gesendet wurde.
- Der lokale Lauf unter Windows belegt Funktion, nicht Trennung (ein Benutzer, Named Pipes).
- HITL ist eine Inhaltsfreigabe, kein Sicherheitstor: wer den Kern-Socket öffnen kann,
  veröffentlicht ohne Freigabe.

### 2.4 Erlaubte Aussage (CC-9)

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
