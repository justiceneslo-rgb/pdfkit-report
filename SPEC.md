# SPEC | pdfkit-report

## Wat dit is

Een npm-component (Node-bibliotheek, geen webapp, geen server). Je geeft het een
beschrijving van een rapport, er komt een PDF uit. Gebouwd op PDFKit.

De hele pitch in een zin: **geen browser, geen Chromium, geen headless dependency.**

## Waarom dit bestaat

Uit het onderzoek van 26-07-2026 (`/home/opc/onderzoek-skills-geld`) kwam dit als
het enige voorstel dat (a) het hoogste bewijs had in eigen code, en (b) geen
verkoopgesprek als eerste stap nodig heeft. Zie DECISIONS.md, besluit 1.

Doel is uitdrukkelijk **niet** omzet op korte termijn. Doel is:
1. Eigen gereedschap: 137 losse PDFKit-scripts op deze server vervangen door een motor.
2. Een meting: werkt "gevonden worden" bij deze gebruiker, ja of nee.

## Doelgroep

Ontwikkelaars die in Node een PDF-export moeten bouwen en op Puppeteer stuiten
(installatiegrootte, koude starts, paginabreuk-bugs). Zij zoeken zelf, lezen code
en willen geen demo of gesprek.

## Functionele eisen

| Nr | Eis | Status |
|---|---|---|
| F1 | Schema in, PDF uit. Buffer, bestand of stream. | af |
| F2 | Tabel breekt nooit een rij doormidden. | af |
| F3 | Tabelkop herhaalt op elke volgende pagina. | af |
| F4 | Tabelkop staat nooit alleen onderaan een pagina. | af |
| F5 | Te lange celinhoud laat de rij groeien, niet afkappen. | af |
| F6 | Drie grafiektypen: staaf, afwijking, spreiding. Als vector, geen plaatje. | af |
| F7 | Assen op ronde getallen (nice-scale). | af |
| F8 | Kop- en voettekst op elke pagina, met `{page}` en `{pages}`. | af |
| F9 | Alinea's houden minimaal 2 regels aan weerszijden van een breuk. | af |
| F10 | Een kop verhuist mee met het blok eronder. | af |
| F11 | Zelfde invoer geeft zelfde bytes (bij vaste creationDate). | af |
| F12 | Eigen bloktypen registreerbaar zonder de library te wijzigen. | af |
| F13 | Layout-log als resultaat, zodat gedrag testbaar is zonder pixelvergelijking. | af |

## Niet-functionele eisen

- Node 18 of nieuwer.
- Precies een directe afhankelijkheid: `pdfkit`. Geen testframework, geen build-stap.
- `npm audit`: 0 critical, 0 high.
- Elke claim in de README wordt gedekt door een test. Geen enkele uitzondering,
  dit is het verkoopargument zelf.

## Buiten scope (bewust)

- Geen HTML- of Markdown-invoer. Wie HTML wil, gebruikt een browser.
- Geen visuele designer of template-editor (dat is `@pdfme`, andere markt).
- Geen multi-tenancy, geen gehoste dienst, geen accounts. Zie DECISIONS.md, besluit 7.
- Geen PDF/A, geen digitale handtekeningen, geen formulieren.
- Geen ondersteuning voor niet-Latijnse schriften met de ingebouwde fonts
  (WinAnsi-beperking van PDFKit; wel mogelijk via een eigen TrueType-font).

## Definitie van klaar voor v0.1.0

- [x] Alle F-eisen af en getest
- [x] Voorbeeld dat na kopieren en plakken werkt
- [x] Voorbeeld-PDF in de repo
- [x] README waarin elke claim door een test gedekt wordt
- [ ] Publiek op GitHub
- [ ] Gepubliceerd op npm
