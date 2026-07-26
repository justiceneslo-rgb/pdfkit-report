# agents.md | pdfkit-report

## Lees dit eerst, in deze volgorde

1. `SPEC.md` | wat moet het doen, en wat uitdrukkelijk niet
2. `ARCHITECTURE.md` | hoe het in elkaar zit, en waarom PDFKit de marges niet krijgt
3. `PROGRESS.md` | wat af is en wat rest
4. `DECISIONS.md` | waarom bepaalde keuzes zo zijn
5. `BUGS.md` | wat al eens misging

Pas daarna coderen.

## Wat dit project anders maakt

Dit is een npm-component, geen webapp. Er is geen server, geen database, geen
nginx, geen PM2 en geen deploy. De `app-maken`-workflow geldt hier alleen voor
deel A (de contextbestanden), niet voor deel B.

De testsuite is hier geen bijzaak maar het product. Het enige dat een vreemde
ervan overtuigt dat deze code te vertrouwen is zonder de auteur te kennen, is
dat het gedrag getest is. Daarom:

- **Geen functie zonder test.**
- **Geen zin in de README die niet door een test gedekt wordt.** Als je een claim
  toevoegt, voeg je de test toe die hem bewijst. Kan dat niet, dan gaat de claim eruit.

## Coderingsregels

- Nederlands in de contextbestanden, Engels in code, commentaar, README en
  foutmeldingen. De doelgroep is internationaal.
- Geen emojis. Geen em dashes, gebruik komma, dubbele punt of `|`.
- Commentaar legt uit **waarom**, niet wat. Regels die alleen herhalen wat de code
  doet, gaan eruit.
- Geen nieuwe afhankelijkheden zonder een besluit in `DECISIONS.md`. De belofte
  "een directe afhankelijkheid" is een verkoopargument, geen toevalligheid.
- Geen build-stap, geen transpilatie. Plain CommonJS, Node 18 en nieuwer.

## Kritieke don'ts

- **Geef PDFKit nooit marges.** Dan voegt hij zelf pagina's toe en klopt de
  paginatelling en elke breekbeslissing niet meer. Zie DECISIONS.md, besluit 3.
- **Gebruik nooit de impliciete tekstcursor van PDFKit** (`doc.text(x)` zonder
  coordinaten). Altijd absolute `x, y` plus een expliciete `height`.
- **Meet rijhoogtes nooit met een vaste waarde.** Altijd `heightOfString()`,
  anders klopt de breuk niet zodra een cel wikkelt.
- **Gebruik `continued: true` niet** voor lijsten. Het sleept inspringing mee en
  laat de opsommingstekens verlopen zodra een item wikkelt.
- **Voeg geen tekens toe buiten WinAnsi** in standaardteksten. Zie BUGS.md, B1.
- **Verwijder de `overflow`-vangnet in `Layout.space()` niet.** Zonder die
  controle levert inhoud die hoger is dan een pagina een oneindige breeklus op.
- **Verander de betekenis van bestaande layout-events niet.** De tests hangen
  eraan, en gebruikers kunnen dat ook doen.
- **Zet geen type met een index-signatuur in de `Block`-union.** Dan keurt de
  union niets meer af. Zie BUGS.md, B7.
- **Laat een blok nooit stil niets tekenen.** Een kolom die te smal uitkomt of een
  afbeelding die niet gelezen kan worden, moet een fout geven met wat de gebruiker
  moet doen. Stil dataverlies is erger dan een crash.

## Na elke wijziging

1. `npm run check` | tests EN typecheck groen, geen uitzonderingen.
   Wijzig je de publieke API, dan wijzig je `types/index.d.ts` in dezelfde beurt.
2. `node examples/basic.js` en de PDF echt bekijken. Vier van de zes bugs in
   `BUGS.md` zijn gevonden door naar de pagina's te kijken, niet door tests.
   Renderen kan met: `pdftoppm -png -r 88 examples/example-report.pdf out`
3. `PROGRESS.md` bijwerken
4. `BUGS.md` bijwerken bij een gevonden of opgelost probleem
5. `DECISIONS.md` bijwerken als er een keuze is gemaakt die uitleg verdient

## Wat dit project moet bewijzen

Het doel is niet omzet. Het doel is de meting in fase 4 van `PROGRESS.md`:
hoeveel mensen vinden dit zonder dat er iemand benaderd is. Alles wat die meting
schoon houdt, telt. Alles wat afleidt van publiceren, telt niet.
