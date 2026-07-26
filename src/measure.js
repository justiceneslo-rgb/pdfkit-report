'use strict'

const { resolveColumns, measureRow, cellSpec } = require('./blocks/table')
const { chartGeometry } = require('./blocks/chart')

/**
 * How much room a block needs before it is worth starting it on this page.
 *
 * This is what keeps a heading attached to whatever follows it. A heading that
 * reserves only its own height happily sits alone at the foot of a page while
 * its chart moves on without it, which is the single most obvious way a
 * generated report looks machine-made.
 *
 * Charts are atomic, so they report their full height. Tables report their
 * header plus the first row. Text reports its orphan minimum.
 */
function minStartHeight (L, block) {
  if (!block || typeof block !== 'object') return 0
  const { doc, theme } = L

  switch (block.type) {
    case 'bar':
    case 'delta':
    case 'scatter':
      return Math.min(chartGeometry(L, block).total, L.pageCapacity)

    case 'table': {
      try {
        const cols = resolveColumns(block.columns, L.width)
        const fontSize = block.fontSize || theme.size.table
        let need = 0
        if (block.header !== false) {
          const probe = cols.map(c => ({ text: String(c.label == null ? '' : c.label), align: c.headerAlign, bold: true }))
          need += measureRow(L, probe, cols, block.headerFontSize || fontSize)
        }
        const rows = block.rows || []
        if (rows.length) {
          need += measureRow(L, cols.map((c, i) => cellSpec(rows[0], c, i, 0)), cols, fontSize)
        }
        return Math.min(need, L.pageCapacity)
      } catch (err) {
        // A malformed table reports its error when it renders, not here.
        return theme.size.table * 3
      }
    }

    case 'list': {
      const items = block.items || []
      if (!items.length) return 0
      doc.font(theme.font).fontSize(block.fontSize || theme.size.body)
      return doc.heightOfString(String(items[0]), { width: L.width - (block.indent || 16) })
    }

    case 'heading': {
      const level = Math.min(3, Math.max(1, block.level || 2))
      const size = theme.size[level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3']
      doc.font(theme.fontBold).fontSize(size)
      return doc.heightOfString(String(block.text == null ? '' : block.text), { width: L.width })
    }

    case 'image': {
      // Atomic like a chart: report the full drawn height so a heading above it
      // travels with it. Reading the image here is cheap; PDFKit caches it.
      if (!block.src) return 0
      try {
        const img = doc.openImage(block.src)
        const ratio = img.height / img.width
        let width = typeof block.width === 'number' ? block.width : Math.min(img.width, L.width)
        if (width > L.width) width = L.width
        const height = typeof block.height === 'number' ? block.height : width * ratio
        return Math.min(height, L.pageCapacity)
      } catch (err) {
        return 0
      }
    }

    case 'spacer':
      return Math.min(typeof block.height === 'number' ? block.height : theme.gap.block, L.pageCapacity)

    case 'pagebreak':
      return 0

    case 'paragraph':
    case 'text': {
      const size = block.fontSize || theme.size.body
      doc.font(theme.font).fontSize(size)
      const lineHeight = doc.currentLineHeight(true)
      const orphans = block.orphans === undefined ? 2 : Math.max(1, block.orphans)
      return lineHeight * orphans
    }

    default:
      return theme.size.body * 2
  }
}

module.exports = { minStartHeight }
