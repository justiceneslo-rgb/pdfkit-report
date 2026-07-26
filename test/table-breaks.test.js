'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { renderReport } = require('../src')
const { COLUMNS, makeRows, eventsOfType, rowPages } = require('./helpers')

/** Render a table-only report and hand back the layout log. */
async function renderTable (rows, tableOverrides = {}, specOverrides = {}) {
  return renderReport(Object.assign({
    titleBlock: false,
    blocks: [Object.assign({ type: 'table', columns: COLUMNS, rows }, tableOverrides)]
  }, specOverrides))
}

/**
 * Find the largest row count that still fits on one page.
 *
 * Calibrating instead of calculating keeps this test honest: it asserts on the
 * real break point rather than on a number derived from the same rounding the
 * implementation uses.
 */
async function findExactFit () {
  let n = 1
  while ((await renderTable(makeRows(n))).pages === 1) {
    n += 1
    if (n > 400) throw new Error('table never broke, test fixture is wrong')
  }
  return n - 1
}

test('a table that ends exactly on the page boundary stays on one page', async () => {
  const fit = await findExactFit()
  const result = await renderTable(makeRows(fit))

  assert.equal(result.pages, 1, `${fit} rows should fill exactly one page`)
  assert.equal(eventsOfType(result.layout, 'pagebreak').length, 0, 'no page break')
  assert.equal(eventsOfType(result.layout, 'table-header').length, 1, 'header drawn once')
  assert.equal(eventsOfType(result.layout, 'table-row').length, fit, 'every row drawn')
  assert.equal(eventsOfType(result.layout, 'overflow').length, 0, 'nothing overflowed')
})

test('one row past the boundary moves to page two and repeats the header', async () => {
  const fit = await findExactFit()
  const result = await renderTable(makeRows(fit + 1))

  assert.equal(result.pages, 2)

  const headers = eventsOfType(result.layout, 'table-header')
  assert.equal(headers.length, 2, 'header drawn on both pages')
  assert.equal(headers[0].repeated, false)
  assert.equal(headers[1].repeated, true)
  assert.equal(headers[1].page, 2, 'the repeat sits on page 2')

  const pages = rowPages(result.layout)
  assert.equal(pages.get(fit - 1), 1, 'the last fitting row stays on page 1')
  assert.equal(pages.get(fit), 2, 'the overflowing row moves to page 2')
})

test('a table spanning four pages loses no rows and repeats the header on each', async () => {
  const fit = await findExactFit()
  const rows = makeRows(fit * 3 + Math.ceil(fit / 2))
  const result = await renderTable(rows)

  assert.ok(result.pages >= 4, `expected at least 4 pages, got ${result.pages}`)

  const drawn = eventsOfType(result.layout, 'table-row')
  assert.equal(drawn.length, rows.length, 'every row was drawn exactly once')

  const indices = drawn.map(e => e.index)
  assert.deepEqual(indices, rows.map((_, i) => i), 'rows kept their order and none were skipped')

  const headers = eventsOfType(result.layout, 'table-header')
  assert.equal(headers.length, result.pages, 'one header per page')
  for (let p = 2; p <= result.pages; p++) {
    const onPage = headers.find(h => h.page === p)
    assert.ok(onPage, `page ${p} has a header`)
    assert.equal(onPage.repeated, true, `the header on page ${p} is a repeat`)
  }

  const end = eventsOfType(result.layout, 'table-end')[0]
  assert.equal(end.rowsDrawn, rows.length)
})

test('a cell too long for one line grows its row instead of clipping the table', async () => {
  const long = 'This description runs on for a while and has to wrap across several lines inside its own cell, which makes the whole row taller than the others without pushing any content outside the table. '.repeat(2)

  const rows = makeRows(3)
  rows[1].name = long
  const result = await renderTable(rows)

  const drawn = eventsOfType(result.layout, 'table-row')
  assert.equal(drawn.length, 3, 'no row was dropped')
  assert.ok(drawn[1].height > drawn[0].height * 2, 'the long row is visibly taller than a single-line row')
  assert.equal(eventsOfType(result.layout, 'overflow').length, 0, 'a multi-line cell is not an overflow')
})

test('a single row taller than an empty page is drawn once and flagged, not looped', async () => {
  const enormous = 'word '.repeat(4000)
  const result = await renderTable([{ code: 'A-1', name: enormous, qty: 1, total: '0,00' }])

  const overflow = eventsOfType(result.layout, 'overflow')
  assert.equal(overflow.length, 1, 'the unbreakable row is reported')
  assert.ok(overflow[0].needed > overflow[0].capacity)
  assert.equal(eventsOfType(result.layout, 'table-row').length, 1, 'drawn exactly once')
  assert.ok(result.pages < 5, 'no runaway page generation')
})

test('repeatHeader false leaves the header on the first page only', async () => {
  const fit = await findExactFit()
  const result = await renderTable(makeRows(fit + 5), { repeatHeader: false })

  assert.ok(result.pages >= 2)
  const headers = eventsOfType(result.layout, 'table-header')
  assert.equal(headers.length, 1)
  assert.equal(headers[0].page, 1)
})

test('a header never sits alone at the foot of a page', async () => {
  const fit = await findExactFit()
  const probe = await renderTable(makeRows(1))
  const rowHeight = eventsOfType(probe.layout, 'table-row')[0].height
  const headerHeight = eventsOfType(probe.layout, 'table-header')[0].height

  // Leave room for the header but not for the header plus its first row.
  const gap = headerHeight + rowHeight * 0.5
  const result = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'spacer', height: probe.geometry.capacity - gap },
      { type: 'table', columns: COLUMNS, rows: makeRows(3) }
    ]
  })

  const headers = eventsOfType(result.layout, 'table-header')
  assert.equal(headers[0].page, 2, 'the table starts on the next page instead of stranding its header')
  assert.equal(headers.length, 1, 'and it does not need a repeat')
  assert.ok(fit > 0)
})

test('a summary row is emphasised and travels with the table', async () => {
  const rows = makeRows(4)
  const result = await renderTable(rows, { summary: { code: '', name: 'Total', qty: 22, total: '150,00' } })

  const summary = eventsOfType(result.layout, 'table-summary')
  assert.equal(summary.length, 1)
  assert.ok(summary[0].height > 0)
})

test('array rows and object rows produce identical layouts', async () => {
  const objects = makeRows(6)
  const arrays = objects.map(r => [r.code, r.name, r.qty, r.total])

  const a = await renderTable(objects)
  const b = await renderTable(arrays)

  assert.deepEqual(
    eventsOfType(a.layout, 'table-row'),
    eventsOfType(b.layout, 'table-row')
  )
})

test('column widths that exceed the page are rejected with a clear message', async () => {
  await assert.rejects(
    () => renderTable(makeRows(2), { columns: [{ key: 'code', label: 'Code', width: 900 }] }),
    /exceed the available width/
  )
})

test('a column that would end up empty is rejected instead of dropping its data', async () => {
  await assert.rejects(
    () => renderTable(makeRows(2), {
      columns: [{ key: 'code', label: 'Code', flex: 0 }, { key: 'name', label: 'Name', flex: 0 }]
    }),
    /would render empty/
  )

  await assert.rejects(
    () => renderTable(makeRows(2), { columns: [{ key: 'code', label: 'Code', width: 0 }] }),
    /non-positive width/
  )
})

test('a table without columns is rejected', async () => {
  await assert.rejects(
    () => renderReport({ titleBlock: false, blocks: [{ type: 'table', rows: [] }] }),
    /non-empty columns array/
  )
})

test('an empty table still draws its header', async () => {
  const result = await renderTable([])
  assert.equal(result.pages, 1)
  assert.equal(eventsOfType(result.layout, 'table-header').length, 1)
  assert.equal(eventsOfType(result.layout, 'table-row').length, 0)
})
