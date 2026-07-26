'use strict'

/**
 * Images: a logo on the front page, a signature, a screenshot.
 *
 * The natural size is read before anything is drawn, because the layout has to
 * know how tall the image will be to decide whether it still fits. An image is
 * atomic: it never splits across a page. One taller than an empty page is
 * scaled down to fit rather than being cut off, and that is recorded.
 *
 * PDFKit reads PNG and JPEG. Not SVG, not WebP.
 */

function renderImage (L, block) {
  const { doc, theme } = L

  if (!block.src) throw new TypeError('an image block needs a src (path, Buffer or data URI)')

  let source
  try {
    source = doc.openImage(block.src)
  } catch (err) {
    const what = typeof block.src === 'string' ? block.src : 'the supplied buffer'
    throw new Error(`could not read image ${what}: ${err.message}. PDFKit reads PNG and JPEG only.`)
  }

  const natural = { width: source.width, height: source.height }
  const ratio = natural.height / natural.width

  // Work out the drawn size. An explicit width wins, then an explicit height,
  // then the natural size capped at the content width.
  let width
  let height
  if (typeof block.width === 'number' && typeof block.height === 'number') {
    width = block.width
    height = block.height
  } else if (typeof block.width === 'number') {
    width = block.width
    height = width * ratio
  } else if (typeof block.height === 'number') {
    height = block.height
    width = height / ratio
  } else {
    width = Math.min(natural.width, L.width)
    height = width * ratio
  }

  if (!(width > 0) || !(height > 0)) {
    throw new RangeError(`image would be drawn ${width}x${height}pt, which cannot be rendered`)
  }

  // Never wider than the text column.
  if (width > L.width) {
    height = height * (L.width / width)
    width = L.width
  }

  const captionHeight = block.caption
    ? doc.font(theme.font).fontSize(theme.size.caption).heightOfString(String(block.caption), { width: L.width }) + 6
    : 0

  // Taller than a whole page: scale to fit instead of clipping.
  let scaled = false
  if (height + captionHeight > L.pageCapacity) {
    const room = L.pageCapacity - captionHeight
    const factor = room / height
    height = room
    width = width * factor
    scaled = true
  }

  L.space(height + captionHeight, 'image')

  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'left'
  const offset = align === 'center'
    ? (L.width - width) / 2
    : align === 'right' ? L.width - width : 0

  doc.image(block.src, L.x + offset, L.y, { width, height })

  L.record({
    type: 'image',
    width: round(width),
    height: round(height),
    natural,
    scaled
  })
  L.move(height)

  if (block.caption) {
    doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
      .text(String(block.caption), L.x, L.y + 6, {
        width: L.width,
        height: captionHeight,
        align: block.captionAlign || align
      })
    L.move(captionHeight)
  }
}

function round (n) {
  return Math.round(n * 100) / 100
}

module.exports = { renderImage }
