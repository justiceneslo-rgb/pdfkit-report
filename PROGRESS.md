# PROGRESS | pdfkit-report

Laatst bijgewerkt: 26-07-2026

## Fase 1 | Kern (af)

- [x] Projectopzet, pdfkit als enige afhankelijkheid
- [x] `Layout`: pagina-cursor, `space()`, `newPage()`, layout-log
- [x] `theme.js`: kleuren en maten, overrides een niveau diep
- [x] `scale.js`: nice-scale asberekening als pure functies
- [x] Tabel: kolombreedtes (vast en flex), object- en array-rijen, formatters
- [x] Tabel: rijhoogte via `heightOfString`, nooit vast
- [x] Tabel: paginabreuk met herhalende kop, kop nooit alleen onderaan
- [x] Tabel: totaalregel, bijschrift, zebra
- [x] Tekst: kop, alinea, lijst, spacer, divider, pagebreak
- [x] Tekst: weduwe- en weeshandhaving, instelbaar per blok
- [x] Kop verhuist mee met het blok eronder (`measure.js`)
- [x] Grafieken: staaf (met streefwaarde), afwijking, spreiding (meerdere series)
- [x] Kop- en voettekst met `{page}` en `{pages}`, achteraf getekend
- [x] Eigen bloktypen via `options.renderers` en `type: 'custom'`
- [x] Uitvoer als buffer, bestand of stream

## Fase 2 | Tests (af)

- [x] 71 tests, `node:test`, geen framework
- [x] Asberekening, inclusief vlakke reeks en gemengde tekens
- [x] Tabel precies op de paginagrens (zelf-kalibrerend, geen aanname)
- [x] Tabel over vier pagina's, geen rij verloren of van volgorde
- [x] Cel te lang voor een regel, en cel hoger dan een hele pagina
- [x] Alinea splitst zonder woordverlies (tekst uit de PDF teruggelezen)
- [x] Weduwe en wees over een reeks breekpunten
- [x] Kop- en voetnummering per pagina geverifieerd in de PDF-inhoud
- [x] Byte-identieke uitvoer bij vaste creationDate
- [x] Foutmeldingen: onbekend bloktype, blokindex, onmogelijke marges
- [x] Kolom die leeg zou renderen wordt geweigerd (geen stil dataverlies)
- [x] Negatieve spacer loopt niet terug over bestaande inhoud
- [x] Afbeeldingen: verhouding, schalen, uitlijning, ontbrekend bestand

## Fase 3 | Documentatie en voorbeeld (af)

- [x] README met een voorbeeld dat werkt na kopieren en plakken
- [x] Elke claim in de README gedekt door een test
- [x] `examples/basic.js` plus de gegenereerde voorbeeld-PDF (4 paginas)
- [x] Visuele controle van alle vier paginas, vier gebreken gevonden en opgelost
- [x] LICENSE (MIT)
- [x] `npm audit`: 0 kwetsbaarheden

## Fase 3b | Klaar voor publicatie (af, 26-07-2026)

- [x] Afbeeldingen-blok (`type: 'image'`), PNG en JPEG, pad of Buffer
- [x] TypeScript-definities (`types/index.d.ts`), volledige API
- [x] Type-test die onder `--strict` compileert en ook toetst wat NIET mag compileren
- [x] CI-workflow: Node 18/20/22/24 op Linux, plus macOS en Windows op 22
- [x] `npm run check` (tests plus typecheck), `pretest` maakt de testafbeelding
- [x] `npm pack` gecontroleerd: 13 bestanden, 23,7 kB, geen tests of voorbeelden mee

## Fase 4 | Publiceren (deels af, 26-07-2026)

- [x] GitHub-repo publiek: https://github.com/justiceneslo-rgb/pdfkit-report
- [x] `repository`, `bugs` en `homepage` in `package.json`
- [x] CI-badge en npm-badge in de README
- [x] Eerste push (twee commits, 35 bestanden)
- [ ] CI-uitslag nakijken en zo nodig repareren
- [ ] Trefwoorden bij "About" op GitHub: pdf, pdfkit, report, nodejs,
      typescript, page-break, charts
- [ ] `CHANGELOG.md` bij de eerste versie na 0.1.0
- [ ] Publiceren op npm als 0.1.0 (npm-account nodig, apart van GitHub)
- [ ] Een technische post over paginabreuk-veilige tabellen in PDFKit,
      met code en de voorbeeld-PDF, geplaatst waar ontwikkelaars zelf zoeken
- [ ] Profiel op een dev-marktplaats met dit als portfoliostuk
- [ ] Meten na 8 weken: repo-bezoeken, npm-downloads, reacties.
      Dat getal is het eigenlijke doel van dit project.

## Fase 5 | Eigen gebruik (open)

- [ ] `shoqbody-app/backend/routes/reports.js` omzetten naar deze motor
- [ ] `Receptenboekfam_app/backend/routes/export.js` omzetten
- [ ] `trading/generate-pdf.js` omzetten
- [ ] `phygital/pdf-engine.js` beoordelen: omzetten of laten staan

## Mogelijk later, niet nu

- [ ] TypeScript-definities (`types/index.d.ts`)
- [ ] Kolomgroepen en samengevoegde cellen
- [ ] Lijngrafiek
- [ ] Inhoudsopgave met paginaverwijzingen
