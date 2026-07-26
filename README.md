# pdfkit-report

[![test](https://github.com/justiceneslo-rgb/pdfkit-report/actions/workflows/test.yml/badge.svg)](https://github.com/justiceneslo-rgb/pdfkit-report/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/pdfkit-report)](https://www.npmjs.com/package/pdfkit-report)

Schema in, PDF report out. Page-break-safe tables that repeat their header, charts drawn as vectors, running headers and footers with real page numbers.

Built on [PDFKit](https://pdfkit.org). **No browser, no Chromium, no headless dependency.**

```bash
npm install pdfkit-report
```

## Why this exists

The usual way to make a PDF report in Node is to render HTML and print it with Puppeteer. That works until it does not: a Chromium download in your image, cold starts measured in seconds on serverless, memory spikes under concurrency, and tables that split across a page break in ways CSS gives you almost no control over.

This library skips the browser. It takes a description of the report and draws it, deciding every page break itself.

| | pdfkit-report | HTML plus Puppeteer |
|---|---|---|
| Install size | 24 MB, one direct dependency | Chromium binary download on top of the package |
| System libraries | none | the usual Chromium runtime set |
| Cold start | process start | browser launch per render |
| 10 000 table rows | 313 pages in 1.4 s, 56 MB heap | not measured here, so no claim |
| Page breaks | decided by the layout, and asserted in tests | delegated to the print engine |
| Same input, same bytes | yes, with a fixed creation date | no |
| TypeScript | declarations included, checked in CI | depends on your HTML |

## Quick start

```js
const { renderReport } = require('pdfkit-report')

const result = await renderReport({
  title: 'Quarterly operations report',
  subtitle: 'Northern region | Q4 2026',
  footer: { text: 'Commercial in confidence', right: 'page {page} of {pages}' },

  blocks: [
    { type: 'paragraph', text: 'Revenue closed the quarter 12.4 percent above target.' },

    { type: 'heading', level: 2, text: 'Revenue against target' },
    {
      type: 'bar',
      target: 24000,
      data: [
        { label: 'Oct', value: 28470 },
        { label: 'Nov', value: 30120 },
        { label: 'Dec', value: 33800 }
      ]
    },

    { type: 'heading', level: 2, text: 'Service lines' },
    {
      type: 'table',
      zebra: true,
      columns: [
        { key: 'code', label: 'Code', width: 74 },
        { key: 'description', label: 'Description', flex: 1 },
        { key: 'total', label: 'Total', align: 'right', width: 88, format: v => `${v} EUR` }
      ],
      rows: lines,
      summary: { description: 'Total excluding VAT', total: '10168.00' }
    }
  ]
}, { output: 'report.pdf' })

console.log(result.pages)   // 4
```

Run the full example, which produces the four-page document this README describes:

```bash
node examples/basic.js
```

## What it actually does

Every claim below is covered by a test in `test/`. Run `npm test` to see them.

**Tables break correctly.** A row is measured before it is drawn and only drawn if it fits whole, so no row is ever cut in half. When a table crosses a page it repeats its header on the next one. A header is never left stranded at the bottom of a page: if the header plus its first row do not both fit, the whole table starts on the next page. A cell with more text than fits on one line grows its row rather than clipping.

**Text does not strand lines.** A paragraph that has to break keeps at least two lines on each side of the break, and one short enough to survive intact moves to the next page whole instead of splitting. Both minimums are configurable per block.

**Headings travel with their content.** A heading reserves room for itself plus whatever the next block needs to begin. A heading followed by a chart moves down with the chart rather than sitting alone above white space.

**Charts are drawn, not rendered.** Bar, deviation and scatter charts are vectors in the PDF, with axis values rounded to human numbers. A chart never splits across a page.

**Page numbering is real.** `{page}` and `{pages}` in a running header or footer are filled in after layout, when the total is actually known.

**The same spec produces the same bytes.** Pass `meta.creationDate` and two renders of the same spec are byte-identical: diffable in version control, cacheable by hash, and comparable against a reference file in your own tests.

## Blocks

| Type | Purpose | Key options |
|---|---|---|
| `heading` | Section heading, levels 1 to 3 | `level`, `subtitle`, `keepWithNext` |
| `paragraph` | Body text | `align`, `bold`, `italic`, `orphans`, `widows` |
| `list` | Bulleted or numbered list | `ordered`, `bullet`, `indent` |
| `table` | Tabular data | `columns`, `rows`, `summary`, `zebra`, `repeatHeader`, `caption` |
| `bar` | Vertical bar chart | `data`, `target`, `valueLabels`, `height`, `format` |
| `delta` | Deviation from a baseline | `data`, `baseline`, `height` |
| `scatter` | Scatter plot, one or more series | `series` or `points`, `height` |
| `image` | PNG or JPEG, from a path or Buffer | `src`, `width`, `height`, `align`, `caption` |
| `divider` | Horizontal rule | `thickness`, `color` |
| `spacer` | Vertical space | `height` |
| `pagebreak` | Start a new page | none |
| `custom` | Draw it yourself | `draw(layout)` |

### Columns

```js
{ key: 'total', label: 'Total', align: 'right', width: 88, format: v => `${v} EUR` }
```

`width` is an exact width in points. Columns without one share the remaining width, weighted by `flex` (default 1). `format` is skipped for `null`, `undefined` and empty strings, so an empty cell in a summary row stays empty.

Rows may be objects keyed by column, or plain arrays in column order.

### Charts

```js
{ type: 'bar', data: [{ label: 'Oct', value: 28470 }], target: 24000, height: 165 }
```

One series is one colour. Set `colorByPoint: true` when the categories really are unrelated, or give a `color` per data point.

### Images

```js
{ type: 'image', src: 'logo.png', width: 140, align: 'center', caption: 'Figure 1' }
```

`src` is a file path, a Buffer or a data URI. PNG and JPEG, the two formats PDFKit
reads. Give a `width` or a `height` and the other follows from the aspect ratio; give
neither and the natural size is used, capped at the content width. An image never
splits across a page, and one taller than a page is scaled to fit rather than clipped.

## API

```js
const result = await renderReport(spec, options)
```

**options**

| Option | Effect |
|---|---|
| `output` | Write to this path. Resolves once the file is flushed. |
| `stream` | Pipe into a writable stream, for example an HTTP response. |
| `renderers` | Register extra block types: `{ myBlock (layout, block) { ... } }` |

With neither `output` nor `stream`, the PDF is returned as a Buffer.

**result**

| Field | Meaning |
|---|---|
| `pages` | Number of pages |
| `buffer` | The PDF, when not writing to a path or stream |
| `path` | The file written, when `output` was given |
| `layout` | Every layout decision made, in order |
| `geometry` | `width`, `top`, `bottom`, `capacity` of the content area |

### The layout log

`result.layout` is the list of decisions the renderer made: which row landed on which page, where a header was repeated, where a paragraph split, what a chart's axis ended up as.

```js
const result = await renderReport(spec)
const repeats = result.layout.filter(e => e.type === 'table-header' && e.repeated)
```

This is what makes the behaviour testable without comparing rendered pixels, and it is how this library tests itself.

### Express

```js
app.get('/report.pdf', async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf')
  await renderReport(await buildSpec(req.params.id), { stream: res })
})
```

### Custom blocks

```js
{
  type: 'custom',
  draw (L) {
    L.doc.font(L.theme.fontBold).fontSize(14).text('Approved', L.x, L.y, { width: L.width })
    L.move(20)
  }
}
```

`L` is the page cursor: `doc` is the PDFKit document, `x` and `width` are the content box, `y` is where you are, `move(h)` advances, `space(h)` breaks to a new page if `h` does not fit, and `free` is what is left.

## Fonts

The built-in PDFKit fonts (Helvetica, Times, Courier) need no embedding and no files. They use WinAnsi encoding, so characters outside it, including the thin space and most non-Latin scripts, will not render. For those, register a TrueType font and set it in the theme:

```js
renderReport({
  theme: { font: 'Source', fontBold: 'Source-Bold' },
  blocks: [{
    type: 'custom',
    draw (L) {
      L.doc.registerFont('Source', 'fonts/SourceSans3-Regular.ttf')
      L.doc.registerFont('Source-Bold', 'fonts/SourceSans3-Bold.ttf')
    }
  }, ...]
})
```

## TypeScript

Declarations ship with the package, so `import { renderReport } from 'pdfkit-report'`
is typed without a separate `@types` install. Block types are a discriminated union
on `type`, which means an unknown block or a missing required field is a compile
error rather than a runtime one.

Registering your own block type is opted into explicitly, so the built-in union keeps
rejecting typos:

```ts
import type { ReportSpec, ExtensionBlock } from 'pdfkit-report'

interface StampBlock extends ExtensionBlock {
  type: 'stamp'
  label: string
}

const spec: ReportSpec<StampBlock> = {
  blocks: [{ type: 'stamp', label: 'APPROVED' }]
}
```

The declarations are compiled under `--strict` in CI against a test file that also
asserts what must *not* compile, so they cannot drift away from the runtime.

## Tests

```bash
npm test          # 74 tests
npm run types     # type declarations under --strict
npm run check     # both
```

No test framework beyond the Node runner, and no network access. They cover the axis
maths, the three page-break cases that matter (a table ending exactly on the boundary,
a table spanning four pages, a cell too long for one line), widow and orphan handling,
running header and footer numbering, image scaling and placement, byte reproducibility,
and the error messages.

Tested on Node 18, 20, 22 and 24, on Linux, macOS and Windows.

## Requirements

Node 18 or newer. One direct dependency: `pdfkit`.

## Licence

MIT
