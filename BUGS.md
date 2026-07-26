# BUGS | pdfkit-report

## B1 | Thin space rendert verkeerd met de ingebouwde fonts

- **Issue:** duizendtallen in as-labels werden gescheiden met U+2009.
- **Oorzaak:** de ingebouwde PDFKit-fonts gebruiken WinAnsi-encoding en die kent
  U+2009 niet. Het teken kwam verkeerd in de PDF terecht.
- **Oplossing:** gewone spatie (U+0020) in `formatTick()`.
- **Gevonden door:** de eerste testronde (`scale.test.js`).
- **Status:** opgelost, 26-07-2026.

## B2 | Elke staaf een andere kleur

- **Issue:** een staafgrafiek met een enkele reeks kreeg per staaf een andere
  paletkleur, waardoor een meting leest als losse metingen.
- **Oorzaak:** `seriesColor()` kreeg de index van de staaf mee als reeksindex.
- **Oplossing:** standaard een kleur voor de hele reeks, `colorByPoint: true`
  voor het oude gedrag.
- **Gevonden door:** visuele controle van pagina 1.
- **Status:** opgelost, 26-07-2026.

## B3 | Geen ruimte tussen blokken

- **Issue:** koppen plakten tegen de alinea erboven en bijschriften tegen de
  volgende kop.
- **Oorzaak:** `theme.gap.block` was gedefinieerd maar werd nergens toegepast;
  de renderlus voegde alleen ruimte toe als een blok daar expliciet om vroeg.
- **Oplossing:** `spaceBefore()` in `index.js`, met uitzonderingen voor het eerste
  blok op een pagina en het blok direct na een kop.
- **Gevonden door:** visuele controle van pagina 1 en 4.
- **Status:** opgelost, 26-07-2026.

## B4 | Kop bleef alleen onderaan de pagina achter

- **Issue:** de kop "Intake against outcome" stond onderaan pagina 1, de grafiek
  eronder verhuisde naar pagina 2.
- **Oorzaak:** de kop reserveerde zijn eigen hoogte plus twee regels bodytekst.
  Een grafiek is veel hoger dan twee regels, dus de reservering was te klein.
- **Oplossing:** `minStartHeight()` in `measure.js`; een kop reserveert wat het
  volgende blok minimaal nodig heeft om te beginnen.
- **Gevonden door:** visuele controle van pagina 1.
- **Status:** opgelost, 26-07-2026.

## B5 | Formatter draaide over lege cellen

- **Issue:** de totaalregel toonde " EUR" in een kolom zonder waarde.
- **Oorzaak:** `column.format` werd ook aangeroepen voor lege waarden.
- **Oplossing:** formatter overslaan bij `null`, `undefined` en `''`.
- **Gevonden door:** visuele controle van pagina 4.
- **Status:** opgelost, 26-07-2026.

## B6 | Legenda botste met het bovenste aslabel

- **Issue:** bij een spreidingsgrafiek met legenda overlapte de legendategekst
  met het bovenste getal op de y-as.
- **Oorzaak:** het bovenste tick-label wordt een halve regel boven de plotlijn
  getekend en stak daarmee de legendaruimte in.
- **Oplossing:** 5 punt extra ruimte onder de legenda.
- **Gevonden door:** visuele controle van pagina 2.
- **Status:** opgelost, 26-07-2026.

## B7 | Types keurden niets af

- **Issue:** de `Block`-union accepteerde elk object met een `type`-veld, dus ook
  een kop zonder tekst of een tabel zonder kolommen.
- **Oorzaak:** `ExtensionBlock` (met index-signatuur `[key: string]: any`) zat in
  de union. Zo'n type slokt de hele union op.
- **Oplossing:** `ExtensionBlock` uit de union gehaald; eigen blokken via
  `ReportSpec<MijnBlok>`.
- **Gevonden door:** de typecheck zelf. Zes `@ts-expect-error`-regels werden als
  "unused directive" gemeld, wat betekende dat die gevallen ten onrechte geldig waren.
- **Status:** opgelost, 26-07-2026.

## B8 | Kolommen met flex 0 verloren stil hun data

- **Issue:** kolommen met `flex: 0` kregen breedte 0 en werden overgeslagen bij het
  tekenen. De tabel toonde lege rijen zonder enige melding.
- **Oorzaak:** `drawCells()` sloeg cellen met een binnenbreedte van 0 of minder over,
  en `resolveColumns()` liet breedte 0 toe.
- **Oplossing:** `resolveColumns()` weigert een kolom die 0pt of minder breed
  uitkomt, met een melding die zegt wat je moet doen.
- **Gevonden door:** een reeks randgevallen doorlopen voor de publicatiebeoordeling.
- **Status:** opgelost, 26-07-2026.

## B9 | Negatieve spacer printte over bestaande inhoud

- **Issue:** `{ type: 'spacer', height: -400 }` liet de cursor omhoog lopen, waarna
  volgende tekst over eerdere tekst heen werd getekend.
- **Oorzaak:** de hoogte werd ongefilterd bij `y` opgeteld.
- **Oplossing:** hoogte wordt begrensd op 0 of hoger.
- **Gevonden door:** dezelfde randgevallenronde.
- **Status:** opgelost, 26-07-2026.

## B10 | `node --test test/` werkt niet vanaf Node 22

- **Issue:** de CI faalde op Node 22 en 24 (Linux, macOS en Windows) met
  `Cannot find module '<repo>/test'`. Node 18 en 20 waren groen.
- **Oorzaak:** vanaf Node 22 wordt een positioneel argument van `--test` als
  glob-patroon behandeld in plaats van als map om te doorlopen. Een kale map
  wordt dan als modulepad opgevat. Een glob meegeven faalt precies omgekeerd,
  want Node 18 en 20 nemen die letterlijk.
- **Oplossing:** `test/run.js` leest de map zelf en geeft de gevonden
  `*.test.js`-bestanden door aan `node --test`. Werkt op alle versies en alle
  platforms, en vindt nieuwe testbestanden automatisch, zodat een toegevoegde
  test nooit stil kan overslaan.
- **Gevonden door:** de eerste CI-run na publicatie. Lokaal op Node 20 was niets
  te zien.
- **Status:** opgelost, 26-07-2026.

## B11 | Het testaantal was drie te hoog

- **Issue:** README en documentatie meldden 74 tests. Het zijn er 71.
- **Oorzaak:** `node --test test/` draaide ook `helpers.js`, `pdftext.js` en
  `fixtures/make-fixture.js`, en rekende elk bestand zonder tests als een
  geslaagde test. Die drie zaten dus in het getal.
- **Oplossing:** `test/run.js` draait alleen `*.test.js`. Het getal in de
  README is gecorrigeerd naar 71.
- **Gevonden door:** het verschil in de uitslag na het wijzigen van de runner.
- **Status:** opgelost, 26-07-2026. Dit was een publieke claim, dus de correctie
  telt dubbel: zie de regel in agents.md over geen claim zonder bewijs.

## Bekende beperkingen (geen bugs, bewuste grenzen)

- Niet-Latijnse schriften werken niet met de ingebouwde fonts. Registreer een
  eigen TrueType-font; zie de README.
- `align: 'justify'` wordt op een alinea die over pagina's breekt per regel
  toegepast, waarbij de laatste regel links uitgelijnd blijft.
- Een rij die hoger is dan een lege pagina wordt getekend en gelogd als
  `overflow`. Hij wordt niet over twee pagina's verdeeld.
- Afbeeldingen: alleen PNG en JPEG, want dat is wat PDFKit leest. Geen SVG, geen WebP.
- Alle tabelrijen worden vooraf gemeten, dus geen streaming. Bij honderdduizenden
  rijen wordt geheugen een grens. 10.000 rijen kost 56 MB en 1,4 seconde.
