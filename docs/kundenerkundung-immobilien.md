# Kundenerkundung: Immobilien-Domäne

Diese Datei erfüllt das Ausgangstor der Phase 2: **Ausgabevertrag und Zeit-Baseline
schriftlich**, erhoben vor dem Bau der Domäne `immobilien` in Phase 5 (ADR-0024). Ohne diese
Spur wäre T13 („der ROI ist gemessen") eine Behauptung statt einer Messung.

**Quelle:** mündliche Angabe einer Beraterin oder eines Beraters mit einem realen
Portfolio, erhoben am 2026-09-03. Kein Rückschluss auf Name oder Unternehmen in diesem
Dokument.

## 1. Portfolio-Datensatz

| Feld | Status |
|---|---|
| Adresse | Pflicht |
| Wohnfläche (m²) | Pflicht |
| Zimmer | Pflicht |
| Kaufpreis/Mietpreis | Pflicht |
| Objektart | Pflicht |
| Beschreibung | Pflicht |
| Fotos | Pflicht, ø 12–18 |
| Baujahr | 90 % befüllt |
| Energieausweis | 85 % befüllt |
| Etage | 80 % befüllt |
| Stellplatz | 70 % befüllt |
| Provision | 100 % befüllt |
| Grundriss | 60 % befüllt |

**Ableitung für den Ausgabevertrag der Domäne `immobilien` (Phase 5, EVALS.md §3.8):** jede
Zahl im Inserat muss buchstabengleich aus einem dieser Felder stammen. Die vier Felder unter
100 % Füllgrad (Baujahr, Energieausweis, Etage, Stellplatz, Grundriss) brauchen im Vertrag
eine explizite Regel für den fehlenden Fall — auslassen oder markieren, nicht erfinden.

## 2. Portale und Formatgrenzen

| Portal | Anteil der Inserate |
|---|---|
| ImmoScout24 | ~80 % (Hauptportal) |
| Immowelt | ~15 % |
| Kleinanzeigen | ~5 % |

Jedes Portal hat eigene Grenzen für Beschreibungslänge, Pflichtfelder, Fotoanzahl/-format und
Kategoriewahl. Ein Inserat wird meist für 2–3 Portale separat angepasst — genau die
Wiederholung, die `listingWriter` (Phase 5, ein Agent/Prompt je Portal) ersetzen soll.

## 3. T13 — Zeit-Baseline des manuellen Prozesses

10 reale Inserate, erhoben 2026-09-03, vor dem Bau des Systems:

| Inserat | Dauer |
|---|---|
| 1 | 28 min |
| 2 | 34 min |
| 3 | 41 min |
| 4 | 31 min |
| 5 | 37 min |
| 6 | 29 min |
| 7 | 46 min |
| 8 | 33 min |
| 9 | 39 min |
| 10 | 35 min |

**Ergebnis:** Mittelwert 35,3 min/Inserat · Median 34,5 min · ~40 Inserate/Monat →
**~23,5 Arbeitsstunden/Monat**.

Diese Zahl ist die Baseline-Hälfte von T13. Die Vergleichshälfte (Bearbeitungszeit **mit**
System) fehlt zwangsläufig noch — sie entsteht erst mit einem echten Lauf in Phase 5 (T12).

## 4. Häufigste Fehler und Kosten

| Fehler | Häufigkeit |
|---|---|
| Falscher Preis/m² | 3–5 % |
| Fehlendes Pflichtfeld | 8–10 % |
| Falsche Kategorie/Portalformat | 5–7 % |
| Fehlendes Foto/Grundriss | 5 % |

Korrektur: ø 5–10 min/Fehler → **~3–4 Arbeitsstunden/Monat** allein für Korrekturen. Falsche
oder unvollständige Inserate kosten potenziell Leads und beschädigen den professionellen
Eindruck — dieser Anteil ist nicht beziffert.

## 5. Haltung der Portale zu Automatisierung

Portale bieten teils API- oder Import-Schnittstellen an, abhängig vom Kontotyp und den
aktuellen Bedingungen. Direktes Scraping oder unerlaubter Massenversand riskiert
Kontobeschränkung oder -sperre. **Sicherer Weg:** offizielle API oder eine vom Portal
unterstützte Import-Schnittstelle — kein Scraping (bestätigt die Nicht-Ziel-Zeile
„Konnektoren zu fremden Systemen" in `PRODUCT.md` §5.2).

## 6. Business-Case — Zielrechnung, keine Messung

40 Inserate/Monat × 35,3 min = ~23,5 Arbeitsstunden/Monat. Bei einer Reduktion auf z. B.
10 min/Inserat: ~6,7 Std. → **~16,8 Stunden Einsparung/Monat**.

Diese Rechnung ist ein **Zielwert**, keine Messung — sie extrapoliert eine angenommene
Zielzeit, die noch durch kein System belegt ist. Die tatsächliche Einsparung misst erst T13
in Phase 5, gegen einen echten Lauf (T12).
