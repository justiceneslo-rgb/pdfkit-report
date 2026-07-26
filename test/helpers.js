'use strict'

const COLUMNS = [
  { key: 'code', label: 'Code', width: 70 },
  { key: 'name', label: 'Description', flex: 3 },
  { key: 'qty', label: 'Qty', align: 'right', width: 46 },
  { key: 'total', label: 'Total', align: 'right', width: 70 }
]

/** Rows that are guaranteed to be a single line tall, so heights stay uniform. */
function makeRows (n, prefix = 'Item') {
  const rows = []
  for (let i = 0; i < n; i++) {
    rows.push({ code: `A-${1000 + i}`, name: `${prefix} ${i + 1}`, qty: (i % 9) + 1, total: `${(i + 1) * 12},50` })
  }
  return rows
}

/** All layout events of a given type, in document order. */
function eventsOfType (layout, type) {
  return layout.filter(e => e.type === type)
}

/** The page number each row landed on, indexed by row index. */
function rowPages (layout) {
  const map = new Map()
  for (const e of layout) {
    if (e.type === 'table-row') map.set(e.index, e.page)
  }
  return map
}

module.exports = { COLUMNS, makeRows, eventsOfType, rowPages }
