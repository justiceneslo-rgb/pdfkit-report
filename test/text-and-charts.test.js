'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { renderReport } = require('../src')
const { extractText } = require('./pdftext')
const { eventsOfType } = require('./helpers')

/** Words that are unique and never a substring of one another. */
function tokens (n) {
  const out = []
  for (let i = 0; i < n; i++) out.push('w' + String(i).padStart(4, '0'))
  return out
}

test('a paragraph too long for the page splits without losing a single word', async () => {
  const words = tokens(2000)
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'paragraph', text: words.join(' ') }]
  })

  assert.ok(r.pages >= 3, `the paragraph really did span pages, got ${r.pages}`)
  const para = eventsOfType(r.layout, 'paragraph')[0]
  assert.equal(para.split, true, 'it was split rather than moved whole')

  const rendered = extractText(r.buffer)
  const missing = words.filter(w => !rendered.includes(w))
  assert.deepEqual(missing, [], 'every word survived the page break')
})

test('a paragraph that would strand lines is moved to the next page whole', async () => {
  const probe = await renderReport({ titleBlock: false, blocks: [] })
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'spacer', height: probe.geometry.capacity - 14 },
      { type: 'paragraph', text: tokens(40).join(' ') }
    ]
  })

  const para = eventsOfType(r.layout, 'paragraph')[0]
  assert.equal(para.split, false)
  assert.equal(para.moved, true)
  assert.equal(para.page, 2, 'it moved to page two in one piece')
})

test('a split paragraph never leaves an orphan or a widow line', async () => {
  const probe = await renderReport({ titleBlock: false, blocks: [] })

  // Sweep the break point across a page so every alignment of text against the
  // page boundary gets exercised, not just one lucky case.
  for (let slack = 8; slack <= 60; slack += 4) {
    const r = await renderReport({
      titleBlock: false,
      blocks: [
        { type: 'spacer', height: probe.geometry.capacity - slack },
        { type: 'paragraph', text: tokens(300).join(' ') }
      ]
    })

    const para = eventsOfType(r.layout, 'paragraph')[0]
    if (!para.split) continue

    const segs = para.segments
    assert.ok(segs.length >= 2, 'a split paragraph covers at least two pages')
    assert.ok(segs[0].lines >= 2, `slack ${slack}: first page keeps at least two lines, got ${segs[0].lines}`)
    assert.ok(segs[segs.length - 1].lines >= 2, `slack ${slack}: last page gets at least two lines, got ${segs[segs.length - 1].lines}`)
  }
})

test('the widow and orphan minimums can be raised per block', async () => {
  const probe = await renderReport({ titleBlock: false, blocks: [] })
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'spacer', height: probe.geometry.capacity - 120 },
      { type: 'paragraph', widows: 4, orphans: 3, text: tokens(400).join(' ') }
    ]
  })

  const para = eventsOfType(r.layout, 'paragraph')[0]
  assert.equal(para.split, true)
  assert.ok(para.segments[0].lines >= 3, 'orphan minimum honoured')
  assert.ok(para.segments[para.segments.length - 1].lines >= 4, 'widow minimum honoured')
})

test('explicit newlines inside a paragraph are kept', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'paragraph', text: 'first line\nsecond line\nthird line' }]
  })
  const para = eventsOfType(r.layout, 'paragraph')[0]
  assert.equal(para.lines, 3, 'three hard lines stayed three lines')
})

test('a heading is never left alone at the foot of a page', async () => {
  const probe = await renderReport({ titleBlock: false, blocks: [] })

  // Leave just enough room for the heading itself, but not for the lines under it.
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'spacer', height: probe.geometry.capacity - 26 },
      { type: 'heading', level: 2, text: 'Results' },
      { type: 'paragraph', text: 'The section body follows here.' }
    ]
  })

  const heading = eventsOfType(r.layout, 'heading')[0]
  const paragraph = eventsOfType(r.layout, 'paragraph')[0]
  assert.equal(heading.page, 2, 'the heading moved down with its body')
  assert.equal(paragraph.page, 2, 'and the body followed it')
})

test('a list breaks between items and keeps every item', async () => {
  const items = tokens(60).map((t, i) => `${t} item body text number ${i}`)
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'list', items }]
  })

  assert.ok(r.pages >= 2)
  const drawn = eventsOfType(r.layout, 'list-item')
  assert.equal(drawn.length, items.length, 'no item was dropped at the break')
  assert.deepEqual(drawn.map(e => e.index), items.map((_, i) => i), 'and the order held')

  const rendered = extractText(r.buffer)
  for (const t of tokens(60)) assert.ok(rendered.includes(t), `${t} is on a page`)
})

test('an ordered list numbers its items', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    blocks: [{ type: 'list', ordered: true, items: ['first', 'second', 'third'] }]
  })
  const text = extractText(r.buffer)
  assert.ok(text.includes('1.'))
  assert.ok(text.includes('3.'))
})

test('a page break at the top of an empty page does not add a blank page', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'paragraph', text: 'One' },
      { type: 'pagebreak' },
      { type: 'pagebreak' },
      { type: 'paragraph', text: 'Two' }
    ]
  })
  assert.equal(r.pages, 2, 'the second break was ignored')
  assert.equal(eventsOfType(r.layout, 'pagebreak-skipped').length, 1)
})

test('a negative spacer never walks the cursor back over existing content', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'paragraph', text: 'First line of the page.' },
      { type: 'spacer', height: -400 },
      { type: 'paragraph', text: 'This must land below the first, not on top of it.' }
    ]
  })

  const spacer = eventsOfType(r.layout, 'spacer')[0]
  assert.equal(spacer.height, 0, 'the negative height was clamped')

  const paragraphs = eventsOfType(r.layout, 'paragraph')
  assert.equal(paragraphs.length, 2)
  assert.equal(paragraphs[0].page, 1)
  assert.equal(paragraphs[1].page, 1)
})

test('a bar chart reports its point count and a round axis', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [{
      type: 'bar',
      title: 'Revenue per month',
      data: [
        { label: 'Jan', value: 1200 },
        { label: 'Feb', value: 1850 },
        { label: 'Mar', value: 940 }
      ],
      valueLabels: true
    }]
  })

  const chart = eventsOfType(r.layout, 'chart')[0]
  assert.equal(chart.chart, 'bar')
  assert.equal(chart.points, 3)
  assert.ok(chart.scale.max >= 1850, 'the axis covers the tallest bar')
  assert.equal(chart.scale.min, 0, 'a positive series starts at zero')
})

test('a delta chart centres on its baseline and colours by sign', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [{
      type: 'delta',
      title: 'Difference from target',
      baseline: 100,
      data: [
        { label: 'A', value: 130 },
        { label: 'B', value: 70 },
        { label: 'C', value: 100 }
      ]
    }]
  })

  const chart = eventsOfType(r.layout, 'chart')[0]
  assert.equal(chart.chart, 'delta')
  assert.equal(chart.baseline, 100)
  assert.equal(chart.scale.min, -chart.scale.max, 'the axis is symmetric around the baseline')
})

test('a scatter chart accepts multiple series and point shorthands', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [{
      type: 'scatter',
      title: 'Pre versus post',
      series: [
        { name: 'Group A', points: [{ x: 1, y: 2 }, { x: 2, y: 4 }] },
        { name: 'Group B', points: [[1, 5], [3, 1]] }
      ]
    }]
  })

  const chart = eventsOfType(r.layout, 'chart')[0]
  assert.equal(chart.chart, 'scatter')
  assert.equal(chart.series, 2)
  assert.equal(chart.points, 4, 'both array and object points were read')
})

test('charts survive empty and non-numeric data instead of throwing', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'bar', title: 'Nothing', data: [] },
      { type: 'delta', title: 'Rubbish', data: [{ label: 'x', value: 'abc' }] },
      { type: 'scatter', title: 'Nothing either', points: [] }
    ]
  })

  const charts = eventsOfType(r.layout, 'chart')
  assert.equal(charts.length, 3)
  for (const c of charts) assert.equal(c.empty, true)
  assert.equal(r.pages, 1)
})

test('a chart moves to the next page whole rather than being cut in half', async () => {
  const probe = await renderReport({ titleBlock: false, blocks: [] })
  const r = await renderReport({
    titleBlock: false,
    blocks: [
      { type: 'spacer', height: probe.geometry.capacity - 60 },
      { type: 'bar', title: 'Moved', height: 150, data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }
    ]
  })

  const chart = eventsOfType(r.layout, 'chart')[0]
  assert.equal(chart.page, 2, 'the whole chart moved down')
  assert.equal(r.pages, 2)
})

test('a flat series still gets a usable axis', async () => {
  const r = await renderReport({
    titleBlock: false,
    blocks: [{ type: 'bar', data: [{ label: 'a', value: 5 }, { label: 'b', value: 5 }] }]
  })
  const chart = eventsOfType(r.layout, 'chart')[0]
  assert.ok(chart.scale.max > chart.scale.min, 'the axis did not collapse')
})

test('theme overrides apply without restating the whole palette', async () => {
  const r = await renderReport({
    titleBlock: false,
    compress: false,
    theme: { color: { accent: '#FF0000' } },
    blocks: [{ type: 'heading', level: 2, text: 'Coloured' }]
  })
  const raw = r.buffer.toString('latin1')
  assert.match(raw, /1 0 0 scn|1 0 0 SCN/, 'the override reached the drawing operators')
  assert.equal(eventsOfType(r.layout, 'heading').length, 1)
})
