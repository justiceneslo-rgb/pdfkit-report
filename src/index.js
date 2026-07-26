'use strict'

const fs = require('fs')
const PDFDocument = require('pdfkit')

const { buildTheme } = require('./theme')
const { Layout, paintRunningElements } = require('./layout')
const { renderTable } = require('./blocks/table')
const { renderHeading, renderParagraph, renderList, renderSpacer, renderDivider, renderPageBreak } = require('./blocks/text')
const { renderBar, renderDelta, renderScatter } = require('./blocks/chart')
const { renderImage } = require('./blocks/image')
const { minStartHeight } = require('./measure')

const DEFAULT_MARGINS = { top: 56, right: 56, bottom: 52, left: 56 }

const RENDERERS = {
  heading: renderHeading,
  paragraph: renderParagraph,
  text: renderParagraph,
  list: renderList,
  table: renderTable,
  bar: renderBar,
  delta: renderDelta,
  scatter: renderScatter,
  image: renderImage,
  spacer: renderSpacer,
  divider: renderDivider,
  pagebreak: renderPageBreak,
  custom: (L, block) => {
    if (typeof block.draw !== 'function') throw new TypeError('a custom block needs a draw(layout) function')
    block.draw(L)
  }
}

/**
 * Render a report specification to a PDF.
 *
 * @param {object} spec     the report: page setup, running header/footer, blocks
 * @param {object} [options]
 * @param {string} [options.output]     write to this path and resolve when flushed
 * @param {Writable} [options.stream]   pipe into this stream instead
 * @param {object} [options.renderers]  extra block types, keyed by type name
 * @returns {Promise<{pages:number, layout:Array, buffer?:Buffer, path?:string}>}
 */
async function renderReport (spec, options = {}) {
  if (!spec || typeof spec !== 'object') throw new TypeError('renderReport needs a spec object')
  const blocks = spec.blocks || []
  if (!Array.isArray(blocks)) throw new TypeError('spec.blocks must be an array')

  const theme = buildTheme(spec.theme)
  const margins = Object.assign({}, DEFAULT_MARGINS, spec.page && spec.page.margins)
  const renderers = Object.assign({}, RENDERERS, options.renderers)

  const doc = new PDFDocument({
    size: (spec.page && spec.page.size) || 'A4',
    layout: (spec.page && spec.page.layout) || 'portrait',
    // Margins are handled by Layout, not by PDFKit. Leaving them at zero stops
    // PDFKit from inserting a page of its own the instant text passes the
    // bottom margin, which would break both page numbering and every fit
    // decision the layout just made.
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    bufferPages: true,
    autoFirstPage: true,
    compress: spec.compress !== false,
    info: buildInfo(spec)
  })

  const collecting = !options.output && !options.stream
  const chunks = []
  let target = null

  if (options.output) {
    target = fs.createWriteStream(options.output)
    doc.pipe(target)
  } else if (options.stream) {
    target = options.stream
    doc.pipe(target)
  } else {
    doc.on('data', c => chunks.push(c))
  }

  const headerHeight = spec.header ? (spec.header.height || theme.size.small * 1.6 + 14) : 0
  const footerHeight = spec.footer ? (spec.footer.height || theme.size.small * 1.6 + 12) : 0

  const layout = new Layout(doc, { theme, margins, headerHeight, footerHeight })

  if (spec.title && spec.titleBlock !== false) drawTitleBlock(layout, spec)

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block || typeof block !== 'object') {
      throw new TypeError(`block ${i} is not an object`)
    }
    const render = renderers[block.type]
    if (!render) {
      throw new TypeError(`unknown block type "${block.type}" at index ${i}. Known types: ${Object.keys(renderers).join(', ')}`)
    }

    const previous = blocks[i - 1]
    const gap = spaceBefore(block, previous, theme, layout)
    if (gap > 0) layout.move(gap)

    const next = blocks[i + 1]
    if (block.keepWithNext && next) {
      layout.space(Math.min(minStartHeight(layout, block) + minStartHeight(layout, next), layout.pageCapacity), 'keep-with-next')
    }

    try {
      render(layout, block, { next, previous, index: i })
    } catch (err) {
      err.message = `block ${i} (${block.type}): ${err.message}`
      throw err
    }

    if (typeof block.spaceAfter === 'number') layout.move(block.spaceAfter)
  }

  const totalPages = layout.page
  paintRunningElements(doc, spec, theme, margins, totalPages)

  const done = new Promise((resolve, reject) => {
    if (collecting) {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    } else {
      target.on('finish', () => resolve(null))
      target.on('error', reject)
    }
    doc.on('error', reject)
  })

  doc.end()
  const buffer = await done

  const result = {
    pages: totalPages,
    layout: layout.events,
    // Exposed because custom blocks draw against the same geometry, and
    // because it is what makes the break behaviour testable from outside.
    geometry: {
      width: layout.width,
      top: layout.top,
      bottom: layout.bottom,
      capacity: layout.pageCapacity
    }
  }
  if (buffer) result.buffer = buffer
  if (options.output) result.path = options.output
  return result
}

/**
 * Vertical room in front of a block.
 *
 * Blocks are separated by one standard gap. Three cases get none: the first
 * block on a page, anything directly after a heading (the heading already
 * carries its own trailing gap), and a block that asks for its own value.
 */
function spaceBefore (block, previous, theme, layout) {
  if (typeof block.spaceBefore === 'number') return block.spaceBefore
  if (!previous) return 0
  if (layout.atPageTop) return 0
  if (previous.type === 'heading' || previous.type === 'pagebreak') return 0
  if (block.type === 'pagebreak' || block.type === 'spacer') return 0
  return theme.gap.block
}

function buildInfo (spec) {
  const meta = spec.meta || {}
  const info = {}
  if (spec.title) info.Title = String(spec.title)
  if (meta.author) info.Author = String(meta.author)
  if (meta.subject) info.Subject = String(meta.subject)
  if (meta.keywords) info.Keywords = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : String(meta.keywords)
  if (meta.creator) info.Creator = String(meta.creator)
  // Passing an explicit date makes the output byte-reproducible, which is what
  // makes reference-PDF comparison possible at all.
  if (meta.creationDate instanceof Date) info.CreationDate = meta.creationDate
  return info
}

function drawTitleBlock (L, spec) {
  const { doc, theme } = L
  const title = String(spec.title)
  doc.font(theme.fontBold).fontSize(theme.size.h1).fillColor(theme.color.text)
  const h = doc.heightOfString(title, { width: L.width })
  doc.text(title, L.x, L.y, { width: L.width, height: h })
  L.record({ type: 'title', height: Math.round(h * 100) / 100 })
  L.move(h + 4)

  if (spec.subtitle) {
    doc.font(theme.font).fontSize(theme.size.h3).fillColor(theme.color.muted)
    const sh = doc.heightOfString(String(spec.subtitle), { width: L.width })
    doc.text(String(spec.subtitle), L.x, L.y, { width: L.width, height: sh })
    L.move(sh + 4)
  }

  const ry = L.y + 6
  doc.save().lineWidth(theme.rule.thick).strokeColor(theme.color.accent)
    .moveTo(L.x, ry).lineTo(L.x + Math.min(64, L.width), ry).stroke().restore()
  L.move(theme.gap.block + 6)
}

module.exports = { renderReport, DEFAULT_MARGINS }
