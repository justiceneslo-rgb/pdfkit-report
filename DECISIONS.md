# DECISIONS | pdfkit-report

## 1. Dit bouwen, en niet voor het geld

**Besluit:** de rapportmotor bouwen als eerste product uit het onderzoek van
26-07-2026, met de uitdrukkelijke afspraak dat het geen inkomen hoeft op te leveren.

**Reden:** de omzetkans is klein en gemeten aan vergelijkbare pakketten (`pdfkit-table`
haalt 319.593 downloads per maand, 102 sterren, geen sponsorknop, nul euro) is de kans
dat hier binnen zes maanden een betaalde opdracht uit komt ongeveer 1 op 8.
Wat het wel oplevert: eigen gereedschap in plaats van 137 losse scripts, en de eerste
echte meting of "gevonden worden" werkt waar "benaderen" 22.256 keer faalde.

## 2. Naam `pdfkit-report`

**Besluit:** haken aan de PDFKit-naam in plaats van een eigen merk.

**Reden:** de doelgroep zoekt op "pdfkit table page break" en niet op een merknaam.
`pdfkit-table` bewijst dat dat kanaal werkt. Vrij op npm gecontroleerd op 26-07-2026.

## 3. PDFKit krijgt geen marges

**Besluit:** het document wordt geopend met marges op nul, `Layout` beheert alles.

**Reden:** PDFKit voegt zelf een pagina toe zodra tekst voorbij de ondermarge komt.
Dan klopt de paginatelling niet meer en zijn eerder genomen "past dit"-beslissingen
ongeldig. Zie ARCHITECTURE.md.

## 4. Testen op het layout-log, niet op referentie-PDF's

**Besluit:** elk blok logt zijn beslissingen; de tests asserteren daarop.

**Reden:** het oorspronkelijke plan was referentie-PDF's vergelijken. Dat is bros
(elke cosmetische wijziging breekt elke test) en het zegt niets over waarom iets
brak. Het log toetst het gedrag dat verkocht wordt: welke rij op welke pagina, waar
de kop herhaald is, waar een alinea gesplitst is. Byte-vergelijking blijft mogelijk
via `meta.creationDate` en wordt in een eigen test gebruikt.

## 5. Alinea-breuk zelf wikkelen

**Besluit:** regelopbouw gebeurt in `wrapLines()` en niet door PDFKit.

**Reden:** de layout moet het aantal regels weten voordat hij kan beslissen of hij
mag breken. Zonder dat is weduwe- en weeshandhaving onmogelijk. Past een alinea
zonder breuk, dan gaat hij alsnog in een keer naar PDFKit, want dan werkt `justify`.

## 6. Een kop reserveert ruimte voor het volgende blok

**Besluit:** `minStartHeight()` in `measure.js`; een kop reserveert zijn eigen hoogte
plus wat het volgende blok minimaal nodig heeft.

**Reden:** gevonden bij de eerste visuele controle: de kop "Intake against outcome"
stond alleen onderaan pagina 1 terwijl de grafiek naar pagina 2 verhuisde. Dat is
precies het gebrek dat dit product zegt op te lossen.

## 7. Geen gehoste dienst in v1

**Besluit:** alleen de bibliotheek. Geen API, geen accounts, geen multi-tenancy.

**Reden:** multi-tenancy is aantoonbaar de zwakste plek (nog nooit gebouwd,
alles op deze server is single-tenant). De eerste keer dat gegevens van klant A bij
klant B belanden is het product dood. Pas overwegen als er vraag is die aanwijsbaar is.

## 8. Geen thin space in getallen

**Besluit:** duizendtallen scheiden met een gewone spatie (U+0020).

**Reden:** de ingebouwde PDFKit-fonts gebruiken WinAnsi-encoding, waar U+2009 niet
in zit. Een thin space rendert daar als het verkeerde teken. Gevonden door een test.
Zie BUGS.md, B1.

## 9. Formatters niet loslaten op lege waarden

**Besluit:** `column.format` wordt overgeslagen bij `null`, `undefined` en `''`.

**Reden:** anders wordt een lege cel in een totaalregel " EUR" of "null EUR".
Gevonden bij de visuele controle van pagina 4 van het voorbeeld.

## 10. Eén serie, één kleur

**Besluit:** een staafgrafiek gebruikt standaard een kleur voor alle staven.
`colorByPoint: true` zet het oude gedrag terug.

**Reden:** het palet per staaf laten rouleren maakt van een meting iets dat leest
als zes losse metingen. Gevonden bij de eerste visuele controle.

## 11. TypeScript alleen als definitiebestand, niet als bouwtaal

**Besluit:** de code blijft plain CommonJS; `types/index.d.ts` is met de hand
geschreven. TypeScript staat er als devDependency om die definities te controleren.

**Reden:** de belofte "geen build-stap" is een verkoopargument. Een devDependency
raakt de gebruiker niet: `npm pack` levert 13 bestanden en 23,7 kB, zonder tests,
voorbeelden of tsconfig. De definities worden wel getoetst, want een niet-getoetst
definitiebestand loopt binnen twee versies uit de pas met de werkelijkheid.

## 12. `ExtensionBlock` hoort niet in de `Block`-union

**Besluit:** eigen bloktypen worden opgegeven via een typeparameter,
`ReportSpec<StampBlock>`, in plaats van dat de union een vrij type bevat.

**Reden:** de eerste versie had `ExtensionBlock` (met een index-signatuur) in de
union. Daardoor was elk object met een `type`-veld geldig en keurde de union
niets meer af. De typecheck vond dat meteen: zes gevallen die fout hadden moeten
zijn, compileerden. Zie BUGS.md, B7.

## 13. Geen prestatievergelijking met Puppeteer in de README

**Besluit:** alleen eigen gemeten cijfers noemen (10.000 rijen: 313 paginas in
1,4 seconde, 56 MB). Bij Puppeteer staat "not measured here, so no claim".

**Reden:** Puppeteer draait niet op deze ARM-server, dus een vergelijking zou
verzonnen zijn. De regel uit agents.md geldt ook voor de verkooptekst: geen claim
zonder bewijs. Een lege cel is geloofwaardiger dan een gegokt getal.
