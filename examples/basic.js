'use strict'

/**
 * The example from the README, rendered end to end.
 *
 *   node examples/basic.js
 *
 * Writes examples/example-report.pdf. The data is fixed and the creation date
 * is pinned, so running this twice produces byte-identical files.
 */

const path = require('path')
const { renderReport } = require('../src')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const REVENUE = [18400, 21250, 19870, 24100, 26340, 23980, 17420, 16890, 25630, 28470, 30120, 33800]
const TARGET = 24000

// A deterministic stand-in for measurements: no randomness, so the output is
// reproducible and the example can be diffed between versions.
const SAMPLES = Array.from({ length: 90 }, (_, i) => {
  const pre = 30 + ((i * 7) % 41)
  const gain = 4 + ((i * 13) % 17) - (i % 5)
  return { x: pre, y: pre + gain }
})

const LINES = Array.from({ length: 46 }, (_, i) => ({
  code: `SKU-${2100 + i * 3}`,
  description: i === 11
    ? 'Replacement carrier assembly including mounting bracket, fastener set and the extended warranty that covers on-site labour for twenty four months'
    : `Service line ${i + 1}`,
  qty: (i % 7) + 1,
  unit: `${(38 + (i % 11) * 4).toFixed(2)}`,
  total: `${(((i % 7) + 1) * (38 + (i % 11) * 4)).toFixed(2)}`
}))

const spec = {
  title: 'Quarterly operations report',
  subtitle: 'Northern region | Q4 2026',
  meta: {
    author: 'Justice Digital',
    subject: 'Operations',
    creationDate: new Date('2026-01-15T09:00:00Z')
  },
  header: { text: 'Quarterly operations report', right: 'Northern region', skipFirstPage: true },
  footer: { text: 'Commercial in confidence', right: 'page {page} of {pages}' },

  blocks: [
    {
      type: 'paragraph',
      text: 'Revenue closed the quarter 12.4 percent above target, carried by a strong November and December. ' +
        'The summer dip repeated the pattern of the previous two years and is treated as seasonal rather than as a warning sign. ' +
        'Service lines are listed in full from page two so the figures can be reconciled against the ledger without a second document.'
    },

    { type: 'heading', level: 2, text: 'Revenue against target' },
    {
      type: 'bar',
      data: MONTHS.map((label, i) => ({ label, value: REVENUE[i] })),
      target: TARGET,
      height: 165,
      caption: 'Monthly revenue in euro. The dashed line marks the 24 000 target.'
    },

    { type: 'heading', level: 2, text: 'Deviation from target' },
    {
      type: 'delta',
      baseline: TARGET,
      data: MONTHS.map((label, i) => ({ label, value: REVENUE[i] })),
      height: 150,
      caption: 'Difference from target per month. Four months fell short, eight cleared it.'
    },

    { type: 'heading', level: 2, text: 'Intake against outcome' },
    {
      type: 'scatter',
      series: [{ name: 'Measured pairs', points: SAMPLES }],
      height: 170,
      caption: 'Each point is one case: intake score on the horizontal axis, outcome on the vertical.'
    },

    { type: 'pagebreak' },

    { type: 'heading', level: 2, text: 'Service lines' },
    {
      type: 'paragraph',
      text: 'The table below runs past the bottom of the page. Its header repeats on every page it reaches, and no row is ever cut in half.'
    },
    {
      type: 'table',
      zebra: true,
      columns: [
        { key: 'code', label: 'Code', width: 74 },
        { key: 'description', label: 'Description', flex: 1 },
        { key: 'qty', label: 'Qty', align: 'right', width: 40 },
        { key: 'unit', label: 'Unit', align: 'right', width: 70, format: v => `${v} EUR` },
        { key: 'total', label: 'Total', align: 'right', width: 88, format: v => `${v} EUR` }
      ],
      rows: LINES,
      summary: {
        description: 'Total excluding VAT',
        qty: LINES.reduce((s, l) => s + l.qty, 0),
        total: LINES.reduce((s, l) => s + Number(l.total), 0).toFixed(2)
      },
      caption: 'All amounts exclude VAT.'
    },

    { type: 'heading', level: 2, text: 'Notes' },
    {
      type: 'list',
      items: [
        'Line SKU-2133 carries an extended warranty and is invoiced separately in January.',
        'The July and August shortfall matches the seasonal pattern of 2024 and 2025.',
        'Outcome measurements were taken by two assessors; inter-rater agreement was not calculated for this quarter.'
      ]
    }
  ]
}

renderReport(spec, { output: path.join(__dirname, 'example-report.pdf') })
  .then(r => {
    console.log(`wrote ${r.path}`)
    console.log(`${r.pages} pages, ${r.layout.length} layout events`)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
