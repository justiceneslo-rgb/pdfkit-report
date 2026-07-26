'use strict'

/**
 * Page-break-safe tables.
 *
 * Row heights are measured with heightOfString before anything is drawn, never
 * assumed from the font size, because one long cell has to push the whole row
 * down. A row is only drawn when it fits in full; otherwise the table breaks
 * to a new page and repeats its header there.
 */

const ALIGNMENTS = new Set(['left', 'right', 'center'])

/**
 * Turn the user's column definitions into absolute geometry.
 *
 * `width` is an exact width in points. Columns without one share whatever is
 * left over, weighted by `flex` (default 1).
 */
function resolveColumns (columns, totalWidth) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new TypeError('table block needs a non-empty columns array')
  }

  let fixed = 0
  let flexSum = 0
  for (const col of columns) {
    if (typeof col.width === 'number') {
      if (!(col.width > 0)) throw new RangeError(`column "${col.key || col.label}" has a non-positive width`)
      fixed += col.width
    } else {
      flexSum += typeof col.flex === 'number' ? col.flex : 1
    }
  }

  const free = totalWidth - fixed
  if (free < 0) {
    throw new RangeError(`fixed column widths (${fixed.toFixed(1)}pt) exceed the available width (${totalWidth.toFixed(1)}pt)`)
  }

  const out = []
  let x = 0
  for (const col of columns) {
    const w = typeof col.width === 'number'
      ? col.width
      : (flexSum > 0 ? free * ((typeof col.flex === 'number' ? col.flex : 1) / flexSum) : 0)

    // A column narrower than its own padding has nowhere to put text. Silently
    // skipping it would drop data without a word, so say so instead.
    if (w <= 0) {
      throw new RangeError(`column "${col.key || col.label}" ends up ${w.toFixed(1)}pt wide and would render empty. Give it a width, a flex above 0, or remove it.`)
    }

    const align = ALIGNMENTS.has(col.align) ? col.align : 'left'
    out.push({
      key: col.key,
      label: col.label === undefined ? (col.key || '') : col.label,
      align,
      headerAlign: ALIGNMENTS.has(col.headerAlign) ? col.headerAlign : align,
      format: col.format,
      bold: !!col.bold,
      color: col.color,
      x,
      width: w
    })
    x += w
  }
  return out
}

/** Read one cell out of a row, supporting both object rows and array rows. */
function cellValue (row, col, index) {
  if (Array.isArray(row)) return row[index]
  if (row && typeof row === 'object') return row[col.key]
  return index === 0 ? row : undefined
}

/** Normalise a cell into { text, align, bold, color }. */
function cellSpec (row, col, index, rowIndex) {
  const raw = cellValue(row, col, index)
  const cell = (raw && typeof raw === 'object' && !Array.isArray(raw) && !(raw instanceof Date))
    ? raw
    : { value: raw }

  let text = cell.text
  if (text === undefined) {
    const value = 'value' in cell ? cell.value : raw
    // An absent value stays absent. Running a formatter over null would turn
    // an empty cell in a summary row into "null EUR", which is the kind of
    // detail that makes a generated document look untrustworthy.
    text = (col.format && value !== null && value !== undefined && value !== '')
      ? col.format(value, row, rowIndex)
      : defaultFormat(value)
  }

  return {
    text: text === null || text === undefined ? '' : String(text),
    align: ALIGNMENTS.has(cell.align) ? cell.align : col.align,
    bold: cell.bold === undefined ? col.bold : !!cell.bold,
    color: cell.color || col.color
  }
}

function defaultFormat (value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/**
 * Measure a single row without drawing it.
 * Returns the total row height including vertical padding.
 */
function measureRow (L, cells, cols, fontSize) {
  const { doc, theme } = L
  let tallest = 0
  for (let i = 0; i < cols.length; i++) {
    const cell = cells[i]
    const inner = cols[i].width - theme.gap.cellPadX * 2
    if (inner <= 0) continue
    doc.font(cell.bold ? theme.fontBold : theme.font).fontSize(fontSize)
    const h = cell.text === '' ? fontSize : doc.heightOfString(cell.text, { width: inner })
    if (h > tallest) tallest = h
  }
  return tallest + theme.gap.cellPadY * 2
}

function drawCells (L, cells, cols, fontSize, rowTop, rowHeight, defaultColor) {
  const { doc, theme } = L
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    const cell = cells[i]
    if (cell.text === '') continue
    const inner = col.width - theme.gap.cellPadX * 2
    if (inner <= 0) continue
    doc.font(cell.bold ? theme.fontBold : theme.font)
      .fontSize(fontSize)
      .fillColor(cell.color || defaultColor)
      .text(cell.text, L.x + col.x + theme.gap.cellPadX, rowTop + theme.gap.cellPadY, {
        width: inner,
        height: rowHeight - theme.gap.cellPadY * 2,
        align: cell.align
      })
  }
}

/** Draw the header row at the cursor and return its height. */
function drawHeader (L, cols, options, repeated) {
  const { doc, theme } = L
  const fontSize = options.headerFontSize
  const cells = cols.map(col => ({
    text: col.label === null || col.label === undefined ? '' : String(col.label),
    align: col.headerAlign,
    bold: true,
    color: options.headerColor
  }))

  const height = measureRow(L, cells, cols, fontSize)

  if (options.headerBand !== false) {
    doc.save().fillColor(options.headerBandColor)
      .rect(L.x, L.y, L.width, height).fill().restore()
  }

  drawCells(L, cells, cols, fontSize, L.y, height, options.headerColor)

  doc.save().lineWidth(theme.rule.medium).strokeColor(options.ruleColor)
    .moveTo(L.x, L.y + height).lineTo(L.x + L.width, L.y + height).stroke().restore()

  L.record({ type: 'table-header', repeated: !!repeated, height: round(height) })
  L.move(height)
  return height
}

/**
 * Render a table block.
 *
 * block = {
 *   type: 'table',
 *   columns: [{ key, label, align, width|flex, format, bold }],
 *   rows: [ {...} | [...] ],
 *   summary: {...},        // optional emphasised closing row
 *   zebra: false,
 *   repeatHeader: true,
 *   caption: 'text below the table'
 * }
 */
function renderTable (L, block) {
  const { doc, theme } = L
  const rows = block.rows || []
  const cols = resolveColumns(block.columns, L.width)
  const fontSize = block.fontSize || theme.size.table

  const options = {
    headerFontSize: block.headerFontSize || fontSize,
    headerColor: block.headerColor || theme.color.text,
    headerBand: block.headerBand,
    headerBandColor: block.headerBandColor || theme.color.headBand,
    ruleColor: block.ruleColor || theme.color.line,
    zebraColor: block.zebraColor || theme.color.band
  }

  const repeatHeader = block.repeatHeader !== false
  const showHeader = block.header !== false

  L.record({ type: 'table', rows: rows.length, columns: cols.length })

  // Prepare every row up front: measuring needs the same font state as drawing,
  // and doing it here keeps the drawing loop free of surprises.
  const prepared = rows.map((row, i) => {
    const cells = cols.map((col, c) => cellSpec(row, col, c, i))
    return { cells, height: measureRow(L, cells, cols, fontSize) }
  })

  let headerHeight = 0
  if (showHeader) {
    const probe = cols.map(col => ({ text: String(col.label == null ? '' : col.label), align: col.headerAlign, bold: true }))
    headerHeight = measureRow(L, probe, cols, options.headerFontSize)
  }

  // Never leave a header stranded at the bottom of a page: the header plus at
  // least one row has to fit, or the whole table starts on the next page.
  const firstRowHeight = prepared.length ? prepared[0].height : 0
  if (!L.atPageTop) L.space(headerHeight + firstRowHeight, 'table-start')

  if (showHeader) drawHeader(L, cols, options, false)

  let drawn = 0
  for (let i = 0; i < prepared.length; i++) {
    const { cells, height } = prepared[i]

    const broke = L.space(height, 'table-row')
    if (broke && showHeader && repeatHeader) drawHeader(L, cols, options, true)

    if (block.zebra && i % 2 === 1) {
      doc.save().fillColor(options.zebraColor).rect(L.x, L.y, L.width, height).fill().restore()
    }

    drawCells(L, cells, cols, fontSize, L.y, height, theme.color.text)

    doc.save().lineWidth(theme.rule.thin).strokeColor(options.ruleColor)
      .moveTo(L.x, L.y + height).lineTo(L.x + L.width, L.y + height).stroke().restore()

    L.record({ type: 'table-row', index: i, height: round(height) })
    L.move(height)
    drawn++
  }

  if (block.summary) {
    const cells = cols.map((col, c) => {
      const spec = cellSpec(block.summary, col, c, -1)
      spec.bold = true
      return spec
    })
    const height = measureRow(L, cells, cols, fontSize)
    const broke = L.space(height, 'table-summary')
    if (broke && showHeader && repeatHeader) drawHeader(L, cols, options, true)

    doc.save().lineWidth(theme.rule.medium).strokeColor(theme.color.text)
      .moveTo(L.x, L.y).lineTo(L.x + L.width, L.y).stroke().restore()

    drawCells(L, cells, cols, fontSize, L.y, height, theme.color.text)
    doc.save().lineWidth(theme.rule.medium).strokeColor(theme.color.text)
      .moveTo(L.x, L.y + height).lineTo(L.x + L.width, L.y + height).stroke().restore()

    L.record({ type: 'table-summary', height: round(height) })
    L.move(height)
  }

  if (block.caption) {
    const capHeight = doc.font(theme.font).fontSize(theme.size.caption).heightOfString(block.caption, { width: L.width })
    L.space(capHeight + 4, 'table-caption')
    doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
      .text(block.caption, L.x, L.y + 4, { width: L.width, height: capHeight })
    L.move(capHeight + 4)
  }

  L.record({ type: 'table-end', rowsDrawn: drawn })
}

function round (n) {
  return Math.round(n * 100) / 100
}

module.exports = { renderTable, resolveColumns, measureRow, cellSpec }
