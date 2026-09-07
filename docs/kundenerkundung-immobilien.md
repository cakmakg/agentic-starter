# Kundenerkundung: Immobilien-Domäne

Diese Datei erfüllt das Ausgangstor der Phase 2: **Ausgabevertrag und Zeit-Baseline schriftlich**, erhoben vor dem Bau der Domäne `immobilien` in Phase 5 (ADR-0024). Ohne diese Spur wäre T13 („der ROI ist gemessen") eine Behauptung statt einer Messung.

**Quelle:** mündliche Angabe einer Beraterin oder eines Beraters mit einem realen Portfolio, erhoben am 2026-09-03. Kein Rückschluss auf Name oder Unternehmen in diesem Dokument.

## 1. Portfolio-Datensatz

Die folgende Stichprobe umfasst 10 synthetisierte, aber realistisch strukturierte Portfolioeinträge. Sie ist kein Kundenexport und enthält keine realen Personen- oder Kontaktdaten. Die optionalen Felder sind absichtlich teilweise leer. Die Verteilung folgt den in der Erhebung dokumentierten Füllgraden — **nachgezählt an der Tabelle unten**: Energieausweis 9/10 · Etage 8/10 · Grundriss 6/10 (als Wert `false`, siehe unten) · **Baujahr 10/10** · **Stellplatz 10/10**.

> **Korrektur (2026-09-06, beim Umsetzen nachgezählt).** Hier standen zuvor Baujahr 9/10 und Stellplatz 7/10. Beides trifft auf diese Tabelle nicht zu: **jeder** der zehn Datensätze trägt ein Baujahr, und **jeder** trägt eine Stellplatzangabe. Der Unterschied liegt in der Semantik: `kein Stellplatz` (P03, P08) und `fehlt` beim Grundriss (P05–P08) sind **Werte**, keine leeren Felder — „es gibt keinen" ist etwas anderes als „wir wissen es nicht". Genau diese Unterscheidung muss der Vertrag treffen, deshalb wird sie hier nicht geglättet. Wirklich leer sind nur: Energieausweis bei P10, Etage bei P09 und P10.

Der Datensatz existiert maschinenlesbar unter `evals/domains/immobilien/golden/portfolio.json`; dort ist auch dokumentiert, wie die Anzeigeformen dieser Tabelle (82,5 m² · 449.000 € · 2. OG) in die Zahlen übersetzt werden, die der Code erwartet.

| ID | Adresse | Wohnfläche | Zimmer | Preis | PreisTyp | Objektart | Beschreibung | Fotos | Baujahr | Energieausweis | Etage | Stellplatz | Provision | Grundriss |
|---|---|---:|---:|---:|---|---|---|---:|---:|---|---|---|---|---|
| P01 | Venloer Straße 214, 50823 Köln | 82,5 m² | 3 | 449.000 € | Kauf | Wohnung | Helle 3-Zimmer-Wohnung mit gutem Grundriss, Loggia und moderner Einbauküche in zentraler Lage von Ehrenfeld. | 14 | 1998 | B | 2. OG | Tiefgarage | 3,57 % inkl. MwSt. | vorhanden |
| P02 | Aachener Straße 621, 50933 Köln | 96 m² | 3 | 2.150 € | Miete | Wohnung | Ruhige Wohnung mit drei Zimmern, Balkon und viel Tageslicht. Einkaufsmöglichkeiten und ÖPNV sind schnell erreichbar. | 12 | 2012 | A | 1. OG | Stellplatz | 3,57 % inkl. MwSt. | vorhanden |
| P03 | Luxemburger Straße 178, 50939 Köln | 61 m² | 2 | 315.000 € | Kauf | Wohnung | Kompakte 2-Zimmer-Wohnung mit offenem Wohnbereich und Süd-Balkon. Die Wohnung eignet sich auch als Kapitalanlage. | 11 | 1974 | D | 3. OG | kein Stellplatz | 3,57 % inkl. MwSt. | vorhanden |
| P04 | Hauptstraße 47, 51465 Bergisch Gladbach | 124 m² | 5 | 695.000 € | Kauf | Einfamilienhaus | Gepflegtes Einfamilienhaus mit fünf Zimmern, Garten, Terrasse und ausgebautem Dachgeschoss. Die Raumaufteilung eignet sich für Familien und für ein Arbeitszimmer. | 18 | 2006 | B | EG | Doppelgarage | 3,57 % inkl. MwSt. | vorhanden |
| P05 | Bonner Straße 302, 50968 Köln | 74 m² | 2 | 1.480 € | Miete | Wohnung | Moderne 2-Zimmer-Wohnung mit hochwertigem Boden, bodentiefen Fenstern und ruhigem Innenhof. Der Einzug ist nach Absprache möglich. | 13 | 2020 | A | 2. OG | Tiefgarage | 3,57 % inkl. MwSt. | fehlt |
| P06 | Marktstraße 9, 50321 Brühl | 88 m² | 3 | 389.500 € | Kauf | Wohnung | Großzügige 3-Zimmer-Wohnung mit zwei Balkonen, separater Küche und Blick ins Grüne. | 10 | 1986 | C | 1. OG | Außenstellplatz | 3,57 % inkl. MwSt. | fehlt |
| P07 | Dorfstraße 16, 50259 Pulheim | 142 m² | 6 | 795.000 € | Kauf | Einfamilienhaus | Freistehendes Haus mit sechs Zimmern, Garten, Keller und Carport. Das Objekt bietet viel Platz für Familie, Gäste und Homeoffice. | 16 | 2010 | B | EG | Carport | 3,57 % inkl. MwSt. | fehlt |
| P08 | 53840 Troisdorf, Nähe Bahnhof | 55 m² | 2 | 219.000 € | Kauf | Wohnung | Gut geschnittene 2-Zimmer-Wohnung mit Balkon in verkehrsgünstiger Lage. Die genaue Hausnummer wird vor der Besichtigung mitgeteilt. | 9 | 1968 | E | 4. OG | kein Stellplatz | 3,57 % inkl. MwSt. | fehlt |
| P09 | Lindenallee 31, 40233 Düsseldorf | 103 m² | 4 | 2.350 € | Miete | Wohnung | Helle 4-Zimmer-Wohnung mit Loggia, zwei Badezimmern und separatem Kellerraum. Geeignet für eine Familie oder eine Wohngemeinschaft. | 15 | 1995 | C | fehlt | Stellplatz | 3,57 % inkl. MwSt. | vorhanden |
| P10 | Uferweg 8, 53113 Bonn | 68 m² | 2 | 299.000 € | Kauf | Wohnung | Attraktive 2-Zimmer-Wohnung mit Blick auf den Rhein, moderner Küche und guter Anbindung. | 12 | 2001 | fehlt | fehlt | Tiefgarage | 3,57 % inkl. MwSt. | vorhanden |

**Hinweis zur Quotenabbildung:** Die dokumentierte Quote von 85 % beim Energieausweis lässt sich in einer Stichprobe von zehn Datensätzen nicht exakt darstellen; sie ist mit 9/10 angenähert. Für eine exakte Auswertung bräuchte es eine 20er- oder 100er-Stichprobe. **Die Quoten für Baujahr und Stellplatz bildet diese Stichprobe nicht ab** (beide 10/10) — siehe die Korrektur oben.

**Vertragliche Regel für fehlende optionale Felder (entschieden 2026-09-06, ADR-0028):** Ein leeres Feld darf nicht durch einen erfundenen Wert ersetzt werden. Es wird **ausgelassen** — die Variante `nicht angegeben` ist damit verworfen. Grund: die Regel bleibt so rein negativ und ist prüfbar, ohne dass der Writer alle fehlenden Felder aufzählen müsste; ein Inserat, das seine Lücken auflistet, liest sich außerdem wie ein Formular. Der Writer darf keine Zahl für Baujahr, Fläche, Etage, Stellplatz, Grundriss oder Energieausweis ergänzen. `Provision` ist in allen zehn Datensätzen vorhanden und muss, sofern sie ausgegeben wird, aus dem Datensatz stammen.

### 1.1 Kenndaten und notwendige Randfälle

| Prüfpunkt | Datensatz |
|---|---|
| Mietobjekt statt Kaufobjekt | P02, P05, P09 |
| Dezimalfläche mit Komma | P01: 82,5 m² |
| Preis mit Tausendertrennzeichen | P01, P04, P07, P10 |
| Preis ohne Tausendertrennzeichen | P03 — die Tabelle zeigt `315.000 €`, der Rohwert ist `315000`. Der Randfall entsteht erst im **Inseratstext** (N05), nicht im Datensatz |
| ~~Postleitzahl fehlt~~ → **Straße und Hausnummer fehlen**, PLZ und Stadt sind da | P08: `53840 Troisdorf, Nähe Bahnhof`. Die PLZ ist vorhanden; die Beschriftung war vertauscht. Für den Checker ist das der interessantere Fall: aus der Adresse lassen sich hier **weniger** Zahlen belegen |
| Lange Beschreibung | P04 |
| Wirklich leere optionale Felder | Energieausweis: P10 · Etage: P09, P10. Bei P05–P08 ist `Grundriss: fehlt` ein **Wert** (kein Grundriss vorhanden), kein leeres Feld |
| Kein Stellplatz | P03, P08 |

## 2. Bozuk ilan kümesi — golden negative dataset

> **Ausführbar seit 2026-09-06.** Diese Tabelle ist die Quelle; die maschinenlesbare Fassung steht in
> `evals/domains/immobilien/golden/negative-listings.json` und wird von `tests/immobilien.test.js`
> datengetrieben abgespielt. Geprüft werden **Gründe**, nicht „verletzt ja/nein": fast jeder dieser
> kurzen Texte verletzt nebenbei auch Pflichtfelder, weil er kein volles Inserat ist — wer nur auf
> „es gab eine Verletzung" prüft, bekäme selbst dann grün, wenn der Prüfer die eigentliche Sache
> übersieht. **Stand 2026-09-06: alle zwölf Fälle laufen grün.** Vier waren zunächst `todo` (N06,
> N07, N10, N12) und sind mit ADR-0028 geschlossen — bei N07 wurde dabei die **Erwartung gedreht**,
> nicht der Code gebogen: „zwei Balkone" steht in der Beschreibung von P06 und ist damit belegt.

Diese Fälle sind absichtlich fehlerhaft. Jeder Eintrag besteht aus einem Datensatzbezug, einem Inseratstext und der erwarteten Verletzung. Die Fälle sollen prüfen, ob der Checker tatsächlich unbelegte Zahlen und Pflichtfeld eksikliklerini yakalar; yalnızca “başarılı” sonuç veren ama hiç ihlal yakalamayan bir kontrolcü yeterli değildir.

| ID | Datensatz | İlan metni | Beklenen ihlal |
|---|---|---|---|
| N01 | P01 | Helle 3-Zimmer-Wohnung mit 82,5 m² Wohnfläche. Nur 5 Minuten zur Straßenbahn. | Uydurulmuş sayı: `5`; ulaşım süresi kayıtta yok. Beklenen: `unbelegte Zahl 5`. |
| N02 | P01 | 82,5 m², Kaufpreis 450.000 €, 3 Zimmer, Baujahr 1998. | Yanlış fiyat: kayıt değeri 449.000 €; `450.000` izinli değil. |
| N03 | P05 | Moderne 2-Zimmer-Wohnung, 74 m², 1.480 € monatlich. | Eksik zorunlu alan: `adresse` veya ilan bağlamındaki adres yok. Beklenen: required field ihlali. |
| N04 | P01 | Kaufpreis 450.000 €. | Fiyat ihlali N02 ile aynı. Ayrı vaka olarak değeri, **minimal metin** olması: burada ek olarak eksik zorunlu alanların (`wohnflaeche_m2`, `zimmer`) da raporlanması gerekir. Test bunu ayrıca doğruluyor; yoksa N02'nin kopyası olurdu. |
| N05 | P04 | Kaufpreis 695000 €, Wohnfläche 124 m², 5 Zimmer. | Sayı biçimi normalleştirme: `695000` ile kayıttaki `695.000` eşdeğer kabul edilmeli; burada fiyat ihlali oluşmamalı. |
| N06 | P04 | Kaufpreis 695 000 €, Wohnfläche 124 m², 5 Zimmer. | Non-breaking space ile binlik ayraç testi; `695 000` normalleştirilerek kayıttaki 695.000 ile eşleşmeli. |
| N07 | P06 | 88 m², 3 Zimmer, 389.500 €, zwei Balkone. | `2` / `zwei` açıklama sayısı: `beschreibung` içindeki “zwei” veri alanında yok; sözleşme açıklama sayılarının politikasını netleştirmeli. Eğer açıklama sayıları izinli değilse ihlal işaretlenmeli. |
| N08 | P03 | 61 m², 2 Zimmer, 315.000 €, 7 Minuten zum Bahnhof. | Uydurulmuş sayı: `7`; ayrıca ulaşım süresi kayıtta yok. |
| N09 | P09 | 103 m², 4 Zimmer, 2.350 € kalt, Etage 6. OG. | Kayda göre etage eksik; kayıt olmayan `6` sayısı kullanılmış. Beklenen: eksik optional field için değer uydurma ihlali. |
| N10 | P10 | 68 m², 2 Zimmer, 299.000 €, Baujahr 2001, Energieklasse B. | **Düzeltme (2026-09-06):** `2001` uydurma değil — P10'un `baujahr` alanı zaten 2001. Uydurma olan yalnızca `Energieklasse B`; P10'da `energieausweis` boş. `B` rakam olmadığı için sayı kontrolü onu göremiyor → `todo`. |
| N11 | P02 | 96 m², 3 Zimmer, 2.150 €, 2 Balkone. | Kayıtta balkon sayısı yok; `2` allowedNumbers kapsamı dışındaki açıklama alanından geliyor. |
| N12 | P01 | 82,5 m², 3 Zimmer, 449.000 €, 3,57 % Provision. | Komisyon değeri veri alanında mevcutsa geçmeli. Bu vaka, `provision` allowedNumbers() içinde değilse yanlış pozitif üreten sözleşme açığını gösterir; beklenen sonuç “checker sözleşmesi gözden geçirilmeli”, otomatik ihlal değil. |

### 2.1 Negatif küme için kabul kriterleri

- N01 ve N08: uydurulmuş ulaşım süreleri yakalanmalı.
- N02: yanlış fiyat yakalanmalı.
- N03: eksik zorunlu alan yakalanmalı.
- N05 ve N06: normalizasyon nedeniyle eşdeğer fiyatlar reddedilmemeli. **Dikkat:** her iki metin de tam
  bir ilan olmadığı için `adresse`/`objektart` eksikliği yine raporlanır — beklenti "hiç ihlal yok"
  değil, "**hiçbir sayı** ihlali yok" biçiminde yazılmalıdır. N06 bugün düşüyor (`todo`).
- N07, N09, N10 ve N11: kayıt dışı veya eksik alandan gelen sayılar yakalanmalı; alanın zorunlu/opsiyonel olmasına göre hata türü ayrılmalı.
- N12: `provision` için checker sözleşmesinin açıkça karar vermesi gerekir. Almanya’daki ilan yükümlülükleri nedeniyle provision bilgisinin sessizce atılmasını kabul eden bir sözleşme eksik sayılır.

## 3. Gerçek veri — yalnızca T12 için

Aşağıdaki bölüm gerçek müşteri export’u değildir. T12’nin gerçek veri şartını karşılamak için müşteriden alınacak tek export’un beklenen kayıt ve doğrulama bilgisini tanımlar. Bu dosyaya müşteri verisi eklenmemiştir; aksi halde sentetik fixture ile gerçek veri birbirine karışır.

### 3.1 T12 export teslim koşulları

- Kaynak: müşterinin tek seferlik export dosyası; kaynak sistemi ve export tarihi kaydedilir.
- Minimum içerik: en az bir gerçek ilan kaydı, alan adları ve ham değerler değiştirilmeden.
- Zorunlu alanlar: adres, Wohnfläche, Zimmer, Preis, PreisTyp, Objektart, Beschreibung ve Fotos referansı.
- Optional alanlar boş kalabilir; boşluklar silinmez ve `null`/boş değer olarak korunur.
- Kişisel veriler, telefon, e-posta ve serbest metindeki gerçek kişi adları test ortamına alınmadan önce maskelenir.
- T12 ölçümü, gerçek export’un `listingWriter` ve checker pipeline’ından geçirilmesiyle yapılır; sentetik P01–P10 bu ölçümün yerine geçmez.

### 3.2 T12 kayıt şablonu

```json
{
  "source": "customer-export",
  "exportedAt": "YYYY-MM-DD",
  "recordId": "CUSTOMER-RECORD-ID",
  "adresse": "ORIGINAL ADDRESS",
  "wohnflaeche_m2": null,
  "zimmer": null,
  "preis": null,
  "preisTyp": "kauf|miete",
  "objektart": "ORIGINAL PROPERTY TYPE",
  "beschreibung": "ORIGINAL DESCRIPTION",
  "fotos": null,
  "baujahr": null,
  "energieausweis": null,
  "etage": null,
  "stellplatz": null,
  "provision": null,
  "grundriss": null
}
```

> **Format-Korrektur (2026-09-06).** Im Template standen `"fotos": []` und `"preisTyp": "Kauf|Miete"`.
> Beides widersprach der eigenen Tabelle in §1 und dem Code: `fotos` ist eine **Anzahl** (dort 9–18,
> keine Liste), und `preisTyp` steht in `src/domains/immobilien/data/portfolioFixture.js` **klein**.
> Ein Template, das mit dem Zielformat streitet, produziert genau den Import, den man danach von Hand
> nachbessert.

**T12 sonucu bu dosya doldurulmadan raporlanamaz.** T12 için yalnızca gerçek müşteri export’undan alınan değerler kullanılmalı; P01–P10 ve N01–N12 doğrulama fixture’larıdır.

## 4. Kontrat boşlukları ve açık kararlar

Bu veri kümesi, checker sözleşmesindeki belirsizlikleri görünür kıldı. **Hepsi 2026-09-06'da
çalıştırılarak doğrulandı, sonra da kapatıldı** — kararlar `DECISIONS.md` ADR-0028'de, kanıtları
`tests/immobilien.test.js` içinde (27 test, `todo` yok). Aşağıdaki liste artık **açık sorular
değil, verilmiş kararların gerekçesi**. Beşinci ve altıncı madde veri kümesi yazılırken çıktı ve
ilk listede yoktu:

1. **Provision — ✅ karar: izinli.** `allowedNumbers()` gerçekte `wohnflaeche_m2`, `zimmer`, `preis`, `baujahr`, `etage`, `stellplatz`, `fotos` ve adresteki sayıları kapsıyor; `provision` **yok**. Sonuç: `3,57 %` haksız yere “unbelegte Zahl” sayılıyor. `provision` izinli sayılar kapsamına alınmalı veya provision için açık bir özel kural tanımlanmalıdır. İlanın hukuken gerekli bir bilgisini yazardan atlatan bir sözleşme kabul edilmemelidir.
2. **Beschreibung sayıları — ✅ karar: izinli (kaynak alan olduğu için).** “3-Zimmer”, “zwei Balkone” veya “5 Minuten” gibi sayılar farklı kökenlere sahiptir. `zimmer` gibi kayıt alanından gelen sayı izinli olabilir; ulaşım süresi veya balkon sayısı gibi kayıt dışı sayılar izinli olmamalıdır. Checker; alan kökenini, normalize edilmiş değerleri ve kaynak metin konumunu ayırmalıdır.
3. **Energieausweis — ✅ karar: ayrı kural, iki yönlü.** `energieausweis` veri kümesinde yüksek doluluk oranına sahip olmasına rağmen `REQUIRED_TEXT_FIELDS` içinde yer almıyorsa, alanın varlığı ve ilanda gösterilmesi ayrıca doğrulanmalıdır. “B” tek başına sayı olmadığı için mevcut sayı checker’ı bunu fark etmeyebilir; bu, alanın gereksiz olduğu anlamına gelmez.
4. **Eksik optional alanlar — ✅ karar: atla (`nicht angegeben` reddedildi).** Baujahr, Energieausweis, Etage, Stellplatz ve Grundriss boşsa writer değer uydurmamalıdır. Çıktı ya alanı atlamalı ya da standart bir `nicht angegeben` işareti kullanmalıdır; hangi davranışın seçileceği sözleşmede tek ve test edilebilir biçimde yazılmalıdır.

5. **Ondalıklı sayı — ✅ düzeltildi (defektti, belirsizlik değil).** `normalizeNumber` alan
   değerine de uygulanıyor ve **tüm noktaları** siliyor: `82.5` → `"825"`. Metindeki doğru yazılmış
   `82,5` ise `"82.5"` olarak normalleştiriliyor. İkisi hiçbir zaman eşleşmiyor, yani **P01'in kendi
   wohnflaeche değeri her ilanda “unbelegt” sayılıyor ve üstelik “Pflichtfeld eksik” hatası da
   veriyor.** Sözleşmenin yorumu değil, sayı normalleştirmesinin hatası. §1.1'deki “Dezimalfläche mit
   Komma” randfall'ı tam olarak bunu ortaya çıkarmak için konmuştu ve işini yaptı.

6. **ID şeması — ✅ karar: hem `OBJ-001` hem `P01` tanınır, bulunamayan ID fail-closed.** `portfolioLoader` `/[A-Z]{2,}-\d+/` arıyor (`OBJ-001`). Bu veri kümesindeki
   `P01`–`P10` bu kalıba uymuyor; eşleşme olmayınca yükleyici **sessizce ilk kayda düşüyor**. Ya
   kalıp ya da import'taki ID şeması hareket etmeli — ve sessiz fallback'in kendisi de ayrı bir
   karar: yanlış objeyi ilana çıkarmak, duran bir koşudan pahalıdır.

## 5. Portale und Formatgrenzen

| Portal | Anteil der Inserate |
|---|---|
| ImmoScout24 | ~80 % (Hauptportal) |
| Immowelt | ~15 % |
| Kleinanzeigen | ~5 % |

Jedes Portal hat eigene Grenzen für Beschreibungslänge, Pflichtfelder, Fotoanzahl/-format und Kategoriewahl. Ein Inserat wird meist für 2–3 Portale separat angepasst — genau die Wiederholung, die `listingWriter` (Phase 5, ein Agent/Prompt je Portal) ersetzen soll.

## 6. T13 — Zeit-Baseline des manuellen Prozesses

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

**Ergebnis:** Mittelwert 35,3 min/Inserat · Median 34,5 min · ~40 Inserate/Monat → **~23,5 Arbeitsstunden/Monat**.

Diese Zahl ist die Baseline-Hälfte von T13. Die Vergleichshälfte (Bearbeitungszeit **mit** System) fehlt zwangsläufig noch — sie entsteht erst mit einem echten Lauf in Phase 5 (T12).

## 7. Häufigste Fehler und Kosten

| Fehler | Häufigkeit |
|---|---|
| Falscher Preis/m² | 3–5 % |
| Fehlendes Pflichtfeld | 8–10 % |
| Falsche Kategorie/Portalformat | 5–7 % |
| Fehlendes Foto/Grundriss | 5 % |

Korrektur: ø 5–10 min/Fehler → **~3–4 Arbeitsstunden/Monat** allein für Korrekturen. Falsche oder unvollständige Inserate kosten potenziell Leads und beschädigen den professionellen Eindruck — dieser Anteil ist nicht beziffert.

## 8. Haltung der Portale zu Automatisierung

Portale bieten teils API- oder Import-Schnittstellen an, abhängig vom Kontotyp und den aktuellen Bedingungen. Direktes Scraping oder unerlaubter Massenversand riskiert Kontobeschränkung oder -sperre. **Sicherer Weg:** offizielle API oder eine vom Portal unterstützte Import-Schnittstelle — kein Scraping (bestätigt die Nicht-Ziel-Zeile „Konnektoren zu fremden Systemen" in `PRODUCT.md` §5.2).

## 9. Business-Case — Zielrechnung, keine Messung

40 Inserate/Monat × 35,3 min = ~23,5 Arbeitsstunden/Monat. Bei einer Reduktion auf z. B. 10 min/Inserat: ~6,7 Std. → **~16,8 Stunden Einsparung/Monat**.

Diese Rechnung ist ein **Zielwert**, keine Messung — sie extrapoliert eine angenommene Zielzeit, die noch durch kein System belegt ist. Die tatsächliche Einsparung misst erst T13 in Phase 5, gegen einen echten Lauf (T12).