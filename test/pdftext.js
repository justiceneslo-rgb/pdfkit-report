'use strict'

/**
 * Pull the visible text back out of an uncompressed PDF buffer.
 *
 * PDFKit writes strings as hex runs inside a TJ array, split wherever kerning
 * applies: "page 1" comes out as [<70616765> 20 <2031>]. Concatenating the hex
 * runs and dropping the kerning numbers gives the original characters back,
 * which is enough to assert that a running footer really was painted on every
 * page rather than merely computed.
 *
 * Render with `compress: false` for this to work.
 */
function extractText (buffer) {
  const raw = buffer.toString('latin1')
  let out = ''
  const re = /<([0-9A-Fa-f]+)>/g
  let m
  while ((m = re.exec(raw)) !== null) {
    const hex = m[1]
    if (hex.length % 2 !== 0) continue
    let s = ''
    for (let i = 0; i < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
    }
    out += s
  }
  return out
}

/** How often `needle` appears in the rendered text of `buffer`. */
function countText (buffer, needle) {
  const text = extractText(buffer)
  let count = 0
  let from = 0
  for (;;) {
    const at = text.indexOf(needle, from)
    if (at === -1) break
    count++
    from = at + needle.length
  }
  return count
}

module.exports = { extractText, countText }
