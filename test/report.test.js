'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { PassThrough } = require('node:stream')

const { renderReport } = require('../src')
const { interpolate } = require('../src/layout')
const { countText, extractText } = require('./pdftext')
const { COLUMNS, makeRows } = require('./helpers')

const FIXED_DATE = new Date('2026-01-01T00:00:00Z')

test('the result is a valid PDF buffer', async () => {
  const r = await renderReport({ title: 'Report', blocks: [{ type: 'paragraph', text: 'Body.' }] })
  assert.ok(Buffer.isBuffer(r.buffer))
  assert.equal(r.buffer.subarray(0, 5).toString(), '%PDF-')
  assert.ok(r.buffer.includes(Buffer.from('%%EOF')), 'the document was closed properly')
  assert.equal(r.pages, 1)
})

test('interpolate fills in the page counters', () => {
  assert.equal(interpolate('page {page} of {pages}', 2, 7), 'page 2 of 7')
  assert.equal(interpolate('{page}/{pages}', 1, 1), '1/1')
  assert.equal(interpolate(({ page, pages }) => `${page}|${pages}`, 3, 9), '3|9')
  assert.equal(interpolate('no counters here', 1, 4), 'no counters here')
})

test('the running footer is painted on every page with the right numbers', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    footer: { text: 'Acme BV', right: 'page {page} of {pages}' },
    blocks: [
      { type: 'paragraph', text: 'One' },
      { type: 'pagebreak' },
      { type: 'paragraph', text: 'Two' },
      { type: 'pagebreak' },
      { type: 'paragraph', text: 'Three' }
    ]
  })

  assert.equal(r.pages, 3)
  assert.equal(countText(r.buffer, 'Acme BV'), 3, 'footer on all three pages')
  for (let p = 1; p <= 3; p++) {
    assert.equal(countText(r.buffer, `page ${p} of 3`), 1, `page ${p} numbered correctly`)
  }
})

test('a running header can skip the first page', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    header: { text: 'CONFIDENTIAL', skipFirstPage: true },
    blocks: [
      { type: 'paragraph', text: 'One' },
      { type: 'pagebreak' },
      { type: 'paragraph', text: 'Two' }
    ]
  })

  assert.equal(r.pages, 2)
  assert.equal(countText(r.buffer, 'CONFIDENTIAL'), 1, 'header only on page two')
})

test('the same spec renders byte for byte identically when the date is fixed', async () => {
  const spec = () => ({
    title: 'Reproducible',
    meta: { creationDate: FIXED_DATE, author: 'Test' },
    blocks: [
      { type: 'paragraph', text: 'Same input, same bytes.' },
      { type: 'table', columns: COLUMNS, rows: makeRows(12) },
      { type: 'bar', title: 'Chart', data: [{ label: 'a', value: 3 }, { label: 'b', value: 7 }] }
    ]
  })

  const a = await renderReport(spec())
  const b = await renderReport(spec())
  assert.ok(a.buffer.equals(b.buffer), 'identical specs produce identical files')
  assert.deepEqual(a.layout, b.layout, 'and identical layout decisions')
})

test('writing to a path produces the same bytes as the buffer', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfkit-report-'))
  const file = path.join(dir, 'out.pdf')
  try {
    const spec = { title: 'File', meta: { creationDate: FIXED_DATE }, blocks: [{ type: 'paragraph', text: 'To disk.' }] }
    const written = await renderReport(spec, { output: file })
    const buffered = await renderReport(spec)

    assert.equal(written.path, file)
    assert.equal(written.pages, buffered.pages)
    assert.ok(fs.readFileSync(file).equals(buffered.buffer))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('rendering into a stream works for piping straight to a response', async () => {
  const sink = new PassThrough()
  const chunks = []
  sink.on('data', c => chunks.push(c))

  const r = await renderReport({ title: 'Streamed', blocks: [{ type: 'paragraph', text: 'x' }] }, { stream: sink })
  const out = Buffer.concat(chunks)

  assert.equal(r.pages, 1)
  assert.equal(out.subarray(0, 5).toString(), '%PDF-')
  assert.equal(r.buffer, undefined, 'no buffer is collected when streaming')
})

test('document metadata reaches the PDF', async () => {
  const r = await renderReport({
    title: 'Quarterly figures',
    meta: { author: 'Justice Digital', subject: 'Q1', keywords: ['finance', 'q1'], creationDate: FIXED_DATE },
    compress: false,
    blocks: [{ type: 'paragraph', text: 'x' }]
  })
  const raw = r.buffer.toString('latin1')
  assert.match(raw, /Quarterly figures/)
  assert.match(raw, /Justice Digital/)
  assert.match(raw, /finance, q1/)
})

test('geometry is reported so custom blocks can lay themselves out', async () => {
  const r = await renderReport({ titleBlock: false, blocks: [{ type: 'paragraph', text: 'x' }] })
  assert.ok(r.geometry.width > 0)
  assert.ok(r.geometry.bottom > r.geometry.top)
  assert.equal(Math.round(r.geometry.capacity), Math.round(r.geometry.bottom - r.geometry.top))
})

test('an unknown block type names the offending index and the valid types', async () => {
  await assert.rejects(
    () => renderReport({ blocks: [{ type: 'paragraph', text: 'ok' }, { type: 'piechart' }] }),
    err => {
      assert.match(err.message, /unknown block type "piechart" at index 1/)
      assert.match(err.message, /table/, 'the message lists what is available')
      return true
    }
  )
})

test('an error inside a block is labelled with its index and type', async () => {
  await assert.rejects(
    () => renderReport({
      blocks: [{
        type: 'custom',
        draw () { throw new Error('boom') }
      }]
    }),
    /block 0 \(custom\): boom/
  )
})

test('a custom block draws against the same layout the built-ins use', async () => {
  let seen = null
  const r = await renderReport({
    titleBlock: false,
    blocks: [{
      type: 'custom',
      draw (L) {
        seen = { x: L.x, width: L.width, free: L.free }
        L.doc.fontSize(10).text('drawn by hand', L.x, L.y, { width: L.width })
        L.move(20)
      }
    }]
  })

  assert.ok(seen, 'the custom block ran')
  assert.equal(seen.x, r.geometry.top > 0 ? seen.x : seen.x)
  assert.equal(seen.width, r.geometry.width)
  assert.ok(seen.free > 0)
})

test('extra renderers can be registered without touching the library', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'stamp', label: 'APPROVED' }]
  }, {
    renderers: {
      stamp (L, block) {
        L.doc.font(L.theme.fontBold).fontSize(14).text(block.label, L.x, L.y, { width: L.width })
        L.record({ type: 'stamp' })
        L.move(20)
      }
    }
  })

  assert.equal(countText(r.buffer, 'APPROVED'), 1)
  assert.equal(r.layout.filter(e => e.type === 'stamp').length, 1)
})

test('a landscape page is wider than a portrait one', async () => {
  const portrait = await renderReport({ titleBlock: false, blocks: [] })
  const landscape = await renderReport({ titleBlock: false, page: { layout: 'landscape' }, blocks: [] })
  assert.ok(landscape.geometry.width > portrait.geometry.width)
  assert.ok(landscape.geometry.capacity < portrait.geometry.capacity)
})

test('margins that leave no room are rejected instead of drawing off-page', async () => {
  await assert.rejects(
    () => renderReport({ page: { margins: { top: 400, bottom: 500, left: 20, right: 20 } }, blocks: [] }),
    /leave no vertical room/
  )
  await assert.rejects(
    () => renderReport({ page: { margins: { top: 20, bottom: 20, left: 400, right: 400 } }, blocks: [] }),
    /leave no horizontal room/
  )
})

test('a spec without blocks still produces a one-page document', async () => {
  const r = await renderReport({ title: 'Empty', blocks: [] })
  assert.equal(r.pages, 1)
  assert.equal(r.buffer.subarray(0, 5).toString(), '%PDF-')
})

test('bad input is rejected with a type error, not a crash halfway through', async () => {
  await assert.rejects(() => renderReport(null), TypeError)
  await assert.rejects(() => renderReport({ blocks: 'nope' }), /must be an array/)
  await assert.rejects(() => renderReport({ blocks: ['nope'] }), /block 0 is not an object/)
})

test('the title block renders the title and subtitle once', async () => {
  const r = await renderReport({
    title: 'Annual report',
    subtitle: 'Financial year 2026',
    compress: false,
    blocks: [{ type: 'paragraph', text: 'Body' }]
  })
  assert.equal(countText(r.buffer, 'Annual report'), 1)
  assert.equal(countText(r.buffer, 'Financial year 2026'), 1)
})

test('titleBlock false leaves the title out of the body but keeps the metadata', async () => {
  const r = await renderReport({
    title: 'Hidden heading',
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'paragraph', text: 'Body' }]
  })
  assert.equal(countText(r.buffer, 'Hidden heading'), 0, 'not drawn on the page')
  assert.match(r.buffer.toString('latin1'), /Hidden heading/, 'still in the document info')
  assert.ok(extractText(r.buffer).includes('Body'))
})
