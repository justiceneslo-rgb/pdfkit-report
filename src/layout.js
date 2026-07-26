'use strict'

/**
 * The page cursor.
 *
 * Every block draws through this object instead of relying on PDFKit's own
 * text cursor. That is deliberate: PDFKit adds a page by itself the moment
 * text runs past the bottom margin, which would silently invalidate any page
 * numbering and any "does this row still fit" decision made a moment earlier.
 *
 * So the document is created with zero margins and this class owns the
 * geometry. PDFKit never decides where a page break goes; we do, and we
 * record every decision in `events` so the tests can assert on layout
 * without comparing rendered bytes.
 */
class Layout {
  constructor (doc, opts) {
    this.doc = doc
    this.theme = opts.theme
    this.margins = opts.margins
    this.headerHeight = opts.headerHeight || 0
    this.footerHeight = opts.footerHeight || 0

    this.pageWidth = doc.page.width
    this.pageHeight = doc.page.height

    this.x = this.margins.left
    this.width = this.pageWidth - this.margins.left - this.margins.right
    this.top = this.margins.top + this.headerHeight
    this.bottom = this.pageHeight - this.margins.bottom - this.footerHeight

    if (this.width <= 0) throw new RangeError('page margins leave no horizontal room')
    if (this.bottom <= this.top) throw new RangeError('page margins and running header/footer leave no vertical room')

    this.y = this.top
    this.page = 1
    this.events = []
  }

  /** Height still free on the current page. */
  get free () {
    return this.bottom - this.y
  }

  /** Height of a completely empty page, used to detect unbreakable content. */
  get pageCapacity () {
    return this.bottom - this.top
  }

  record (event) {
    this.events.push(Object.assign({ page: this.page }, event))
    return event
  }

  move (h) {
    this.y += h
  }

  newPage (reason) {
    this.doc.addPage()
    this.page += 1
    this.y = this.top
    this.events.push({ page: this.page, type: 'pagebreak', reason: reason || 'explicit' })
    return this.page
  }

  /**
   * Make sure `h` points are available, breaking to a new page if not.
   * Returns true when a break happened, so callers can repeat a table header.
   *
   * Content taller than an empty page never triggers an endless break loop:
   * it is drawn where it stands and flagged as an overflow instead.
   */
  space (h, reason) {
    if (h > this.pageCapacity) {
      this.events.push({ page: this.page, type: 'overflow', needed: h, capacity: this.pageCapacity, reason: reason || 'block' })
      return false
    }
    if (this.y + h <= this.bottom) return false
    this.newPage(reason || 'fit')
    return true
  }

  /** True when the cursor sits at the very top of an otherwise empty page. */
  get atPageTop () {
    return this.y === this.top
  }
}

/**
 * Draw the running header and footer on every page after the body is done.
 *
 * This runs last on purpose: `{pages}` cannot be known until the last block
 * has been laid out, and PDFKit can only revisit earlier pages when the
 * document was opened with bufferPages.
 */
function paintRunningElements (doc, spec, theme, margins, totalPages) {
  const range = doc.bufferedPageRange()
  const left = margins.left
  const width = doc.page.width - margins.left - margins.right

  for (let i = 0; i < range.count; i++) {
    const pageNumber = range.start + i + 1
    doc.switchToPage(range.start + i)

    if (spec.header) {
      const h = spec.header
      const skipFirst = h.skipFirstPage && pageNumber === 1
      if (!skipFirst) {
        const y = margins.top
        doc.font(theme.font).fontSize(theme.size.small).fillColor(theme.color.muted)
        if (h.text) {
          doc.text(interpolate(h.text, pageNumber, totalPages), left, y, {
            width, height: theme.size.small * 1.6, align: h.align || 'left', lineBreak: false
          })
        }
        if (h.right) {
          doc.text(interpolate(h.right, pageNumber, totalPages), left, y, {
            width, height: theme.size.small * 1.6, align: 'right', lineBreak: false
          })
        }
        if (h.rule !== false) {
          const ry = y + theme.size.small * 1.6 + 4
          doc.save().lineWidth(theme.rule.thin).strokeColor(theme.color.line)
            .moveTo(left, ry).lineTo(left + width, ry).stroke().restore()
        }
      }
    }

    if (spec.footer) {
      const f = spec.footer
      const skipFirst = f.skipFirstPage && pageNumber === 1
      if (!skipFirst) {
        const y = doc.page.height - margins.bottom - theme.size.small * 1.6
        if (f.rule !== false) {
          const ry = y - 6
          doc.save().lineWidth(theme.rule.thin).strokeColor(theme.color.line)
            .moveTo(left, ry).lineTo(left + width, ry).stroke().restore()
        }
        doc.font(theme.font).fontSize(theme.size.small).fillColor(theme.color.muted)
        if (f.text) {
          doc.text(interpolate(f.text, pageNumber, totalPages), left, y, {
            width, height: theme.size.small * 1.6, align: f.align || 'left', lineBreak: false
          })
        }
        if (f.right) {
          doc.text(interpolate(f.right, pageNumber, totalPages), left, y, {
            width, height: theme.size.small * 1.6, align: 'right', lineBreak: false
          })
        }
      }
    }
  }
}

function interpolate (template, page, pages) {
  if (typeof template === 'function') return String(template({ page, pages }))
  return String(template).replace(/\{page\}/g, page).replace(/\{pages\}/g, pages)
}

module.exports = { Layout, paintRunningElements, interpolate }
