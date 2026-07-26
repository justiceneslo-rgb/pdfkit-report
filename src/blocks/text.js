'use strict'

/**
 * Text blocks: headings, paragraphs, lists, spacers and rules.
 *
 * Two rules run through all of them. Paragraphs and list items are measured
 * and broken per item, so a long block continues on the next page instead of
 * being pushed there whole. And a heading is never left alone at the foot of
 * a page: it reserves room for its own height plus two lines of whatever
 * follows.
 */

const HEADING_SIZES = { 1: 'h1', 2: 'h2', 3: 'h3' }

function renderHeading (L, block, ctx) {
  const { doc, theme } = L
  const level = Math.min(3, Math.max(1, block.level || 2))
  const size = theme.size[HEADING_SIZES[level]]
  const text = String(block.text == null ? '' : block.text)

  doc.font(theme.fontBold).fontSize(size)
  const height = doc.heightOfString(text, { width: L.width })

  // A heading travels with what it introduces. Reserve its own height plus
  // whatever the next block needs to make a start, so a heading is never left
  // stranded at the foot of a page while its table or chart moves on without
  // it. `keepWithNext: false` opts out.
  if (block.keepWithNext !== false) {
    const { minStartHeight } = require('../measure')
    const follows = ctx && ctx.next ? minStartHeight(L, ctx.next) : theme.size.body * 2.4
    const guard = height + theme.gap.afterHeading + follows
    doc.font(theme.fontBold).fontSize(size)
    L.space(Math.min(guard, L.pageCapacity), 'heading')
  } else {
    L.space(Math.min(height, L.pageCapacity), 'heading')
  }

  doc.fillColor(block.color || (level === 1 ? theme.color.text : theme.color.accent))
    .text(text, L.x, L.y, { width: L.width, height })

  L.record({ type: 'heading', level, height: round(height) })
  L.move(height)

  if (level === 1 && block.rule !== false) {
    const ry = L.y + 5
    doc.save().lineWidth(theme.rule.thick).strokeColor(theme.color.accent)
      .moveTo(L.x, ry).lineTo(L.x + Math.min(64, L.width), ry).stroke().restore()
    L.move(9)
  }

  L.move(theme.gap.afterHeading)

  if (block.subtitle) {
    doc.font(theme.font).fontSize(theme.size.small).fillColor(theme.color.muted)
    const sh = doc.heightOfString(String(block.subtitle), { width: L.width })
    L.space(sh, 'heading-subtitle')
    doc.text(String(block.subtitle), L.x, L.y, { width: L.width, height: sh })
    L.move(sh + theme.gap.paragraph)
  }
}

/**
 * Break a string into lines that fit `width`, honouring explicit newlines.
 *
 * Wrapping is done here rather than left to PDFKit because the layout has to
 * know the line count before it can decide where the paragraph may break.
 */
function wrapLines (doc, text, width) {
  const lines = []
  for (const hard of String(text).split(/\r?\n/)) {
    const words = hard.split(/[ \t]+/).filter(Boolean)
    if (words.length === 0) { lines.push(''); continue }
    let line = ''
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word
      if (line && doc.widthOfString(candidate) > width) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

/**
 * Paragraph with widow and orphan control.
 *
 * A paragraph may break across pages, but never so that a single line is left
 * behind at the bottom (orphan) or carried over on its own (widow). Both
 * minimums default to two lines and can be set per block. This is the detail
 * that separates a report from a wall of text, and it is exactly what gets
 * lost when a page is printed from a browser.
 */
function renderParagraph (L, block) {
  const { doc, theme } = L
  const size = block.fontSize || theme.size.body
  const text = String(block.text == null ? '' : block.text)
  const align = ['left', 'right', 'center', 'justify'].includes(block.align) ? block.align : 'left'
  const font = block.bold ? theme.fontBold : (block.italic ? theme.fontItalic : theme.font)
  const orphans = block.orphans === undefined ? 2 : Math.max(1, block.orphans)
  const widows = block.widows === undefined ? 2 : Math.max(1, block.widows)

  doc.font(font).fontSize(size)
  const lineHeight = doc.currentLineHeight(true)
  const lines = wrapLines(doc, text, L.width)

  if (lines.length === 0) return

  const pageLines = Math.floor(L.pageCapacity / lineHeight)
  const fitsHere = Math.floor(L.free / lineHeight)

  // Fits where it stands: hand it to PDFKit in one go so justify works.
  if (lines.length <= fitsHere) {
    const height = lineHeight * lines.length
    doc.fillColor(block.color || theme.color.text)
      .text(text, L.x, L.y, { width: L.width, height, align })
    L.record({ type: 'paragraph', lines: lines.length, height: round(height), split: false })
    L.move(height + theme.gap.paragraph)
    return
  }

  // Fits on a fresh page, and breaking here would strand lines: move it whole.
  if (lines.length <= pageLines && (fitsHere < orphans || lines.length - fitsHere < widows)) {
    L.newPage('paragraph-keep-together')
    const height = lineHeight * lines.length
    doc.font(font).fontSize(size).fillColor(block.color || theme.color.text)
      .text(text, L.x, L.y, { width: L.width, height, align })
    L.record({ type: 'paragraph', lines: lines.length, height: round(height), split: false, moved: true })
    L.move(height + theme.gap.paragraph)
    return
  }

  // Genuinely too long: split it, keeping the widow and orphan minimums.
  let drawn = 0
  let index = 0
  let guarded = false
  const segments = []
  while (index < lines.length) {
    let room = Math.floor(L.free / lineHeight)
    if (room < 1) {
      L.newPage('paragraph')
      room = pageLines
    }

    let take = Math.min(room, lines.length - index)
    const left = lines.length - index - take
    if (left > 0 && left < widows) take = Math.max(1, take - (widows - left))

    if (index === 0 && take < orphans && take < lines.length && !guarded) {
      guarded = true
      L.newPage('paragraph-orphan')
      continue
    }

    segments.push({ page: L.page, lines: take })

    for (let i = 0; i < take; i++) {
      const line = lines[index + i]
      const isLast = index + i === lines.length - 1
      doc.font(font).fontSize(size).fillColor(block.color || theme.color.text)
        .text(line, L.x, L.y, {
          width: L.width,
          height: lineHeight,
          align: align === 'justify' && !isLast ? 'justify' : (align === 'justify' ? 'left' : align),
          lineBreak: false
        })
      L.move(lineHeight)
      drawn++
    }

    index += take
    if (index < lines.length) L.newPage('paragraph')
  }

  L.record({ type: 'paragraph', lines: drawn, height: round(drawn * lineHeight), split: true, segments })
  L.move(theme.gap.paragraph)
}

/**
 * Bulleted or numbered list.
 *
 * Each item is drawn as its own text call. PDFKit's `continued: true` is
 * avoided on purpose: it carries indentation state between calls and drops
 * the bullet alignment as soon as an item wraps.
 */
function renderList (L, block) {
  const { doc, theme } = L
  const size = block.fontSize || theme.size.body
  const items = (block.items || []).map(i => String(i == null ? '' : i))
  const ordered = !!block.ordered
  const indent = block.indent || 16
  const gap = block.gap === undefined ? 4 : block.gap
  const textWidth = L.width - indent

  L.record({ type: 'list', items: items.length, ordered })

  for (let i = 0; i < items.length; i++) {
    const marker = ordered ? `${i + 1}.` : (block.bullet || '•')
    doc.font(theme.font).fontSize(size)
    const height = doc.heightOfString(items[i], { width: textWidth })

    L.space(height, 'list-item')

    doc.fillColor(block.markerColor || theme.color.accent)
      .text(marker, L.x, L.y, { width: indent - 4, height: size * 1.4, align: 'left', lineBreak: false })
    doc.fillColor(block.color || theme.color.text)
      .text(items[i], L.x + indent, L.y, { width: textWidth, height })

    L.record({ type: 'list-item', index: i, height: round(height) })
    L.move(height + gap)
  }

  L.move(theme.gap.paragraph)
}

function renderSpacer (L, block) {
  // A negative spacer would walk the cursor back up and overprint what is
  // already on the page. Use a pagebreak to go up, not arithmetic.
  const h = typeof block.height === 'number' ? Math.max(0, block.height) : L.theme.gap.block
  L.space(Math.min(h, L.pageCapacity), 'spacer')
  L.record({ type: 'spacer', height: h })
  L.move(h)
}

function renderDivider (L, block) {
  const { doc, theme } = L
  L.space(10, 'divider')
  const y = L.y + 4
  doc.save().lineWidth(block.thickness || theme.rule.thin)
    .strokeColor(block.color || theme.color.line)
    .moveTo(L.x, y).lineTo(L.x + L.width, y).stroke().restore()
  L.record({ type: 'divider' })
  L.move(10)
}

function renderPageBreak (L) {
  // A break at the very top of an empty page would produce a blank page.
  if (L.atPageTop) {
    L.record({ type: 'pagebreak-skipped' })
    return
  }
  L.newPage('block')
}

function round (n) {
  return Math.round(n * 100) / 100
}

module.exports = { renderHeading, renderParagraph, renderList, renderSpacer, renderDivider, renderPageBreak }
