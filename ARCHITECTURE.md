# ARCHITECTURE | pdfkit-report

## Mappen

```
pdfkit-report/
  src/
    index.js          publieke API: renderReport(spec, options)
    layout.js         de pagina-cursor + kop/voet achteraf tekenen
    theme.js          kleuren, maten, marges, samenvoegen van overrides
    scale.js          asberekening (pure functies, geen PDFKit)
    measure.js        hoeveel ruimte heeft het volgende blok minimaal nodig
    blocks/
      table.js        tabel met paginabreuk en herhalende kop
      text.js         kop, alinea, lijst, spacer, divider, pagebreak
      chart.js        staaf-, afwijkings- en spreidingsgrafiek
  test/               node:test, geen framework
    helpers.js        vaste kolommen en rijen
    pdftext.js        haalt tekst terug uit een ongecomprimeerde PDF
  examples/
    basic.js          het voorbeeld uit de README
    example-report.pdf
```

## Hoe het werkt

`renderReport(spec)` doet vier dingen, in deze volgorde:

1. **Document openen** met marges op nul en `bufferPages: true`.
2. **Blokken renderen.** Elk blok krijgt de `Layout` en tekent daar tegenaan.
   Elke beslissing wordt gelogd in `layout.events`.
3. **Kop en voet tekenen** over alle pagina's, achteraf, want `{pages}` is pas
   bekend als het laatste blok geplaatst is.
4. **Afsluiten** en de buffer, het bestand of de stream opleveren.

## De kern: waarom PDFKit de marges niet krijgt

PDFKit voegt uit zichzelf een pagina toe zodra tekst voorbij de ondermarge komt.
Gebeurt dat, dan klopt de paginatelling niet meer en is elke "past dit nog"-
beslissing van een moment eerder ongeldig.

Daarom staan de PDFKit-marges op nul en beheert `Layout` de geometrie:
`x`, `width`, `top`, `bottom`, `y`, `page`. Blokken gebruiken nooit de impliciete
tekstcursor van PDFKit, altijd absolute coordinaten met een expliciete `height`.

`Layout.space(h)` is het enige punt waar een paginabreuk ontstaat. Geeft `true`
terug als er gebroken is, zodat een tabel weet dat hij zijn kop moet herhalen.

Inhoud die hoger is dan een lege pagina wordt getekend waar hij staat en gelogd
als `overflow`. Zo kan er nooit een oneindige breeklus ontstaan.

## Het layout-log

Elk blok schrijft wat het deed in `layout.events`:

| Event | Betekenis |
|---|---|
| `table-header` | kop getekend, `repeated: true` als het een herhaling is |
| `table-row` | rij getekend, met index en hoogte |
| `table-summary` | totaalregel |
| `paragraph` | met `split`, `lines` en `segments` (regels per pagina) |
| `chart` | type, aantal punten, de gekozen as |
| `pagebreak` | met de reden (`table-row`, `paragraph-orphan`, ...) |
| `overflow` | inhoud paste niet op een lege pagina |

Dit is geen debug-hulpmiddel maar het testmechanisme: de tests asserteren op
deze events in plaats van op gerenderde bytes.

## Afhankelijkheden

Precies een: `pdfkit`. Testrunner is `node:test`. Geen build-stap, geen
transpilatie, geen netwerk tijdens de tests.
