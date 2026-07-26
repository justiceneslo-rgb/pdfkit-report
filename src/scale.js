'use strict'

/**
 * Axis maths. Kept free of PDFKit on purpose: these are the functions that
 * decide where a bar ends and where a gridline sits, so they must be testable
 * without rendering anything.
 */

/**
 * Round a raw step up to the nearest 1, 2, 2.5 or 5 times a power of ten.
 */
function niceStep (raw) {
  if (!(raw > 0)) return 1
  const exp = Math.floor(Math.log10(raw))
  const pow = Math.pow(10, exp)
  const frac = raw / pow
  let nice
  if (frac <= 1) nice = 1
  else if (frac <= 2) nice = 2
  else if (frac <= 2.5) nice = 2.5
  else if (frac <= 5) nice = 5
  else nice = 10
  return nice * pow
}

/**
 * Build an axis that covers [min, max] with round tick values.
 *
 * Returns { min, max, step, ticks } where min <= the data minimum and
 * max >= the data maximum, and every tick is an exact multiple of step
 * (bar the floating point dust we round away below).
 */
function niceScale (min, max, targetTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError('niceScale needs finite min and max')
  }
  if (min > max) [min, max] = [max, min]

  // A flat series still needs a readable axis.
  if (min === max) {
    if (min === 0) { min = 0; max = 1 } else if (min > 0) { min = 0; max = max * 2 } else { max = 0; min = min * 2 }
  }

  const step = niceStep((max - min) / Math.max(1, targetTicks))
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step

  const ticks = []
  // Guard against floating point overshoot on the last tick.
  const count = Math.round((hi - lo) / step)
  for (let i = 0; i <= count; i++) ticks.push(round(lo + i * step))

  return { min: round(lo), max: round(hi), step: round(step), ticks }
}

/**
 * Strip binary floating point dust (0.30000000000000004 -> 0.3) without
 * pulling in a decimal library.
 */
function round (n) {
  return Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(12))
}

/**
 * Map a value onto a pixel position along an axis of `length` points.
 * Returns 0 at scale.min and `length` at scale.max.
 */
function project (value, scale, length) {
  const span = scale.max - scale.min
  if (span === 0) return 0
  return ((value - scale.min) / span) * length
}

/**
 * Default number formatting for axis labels: no trailing zeros, thousands
 * separated with a plain space so it stays neutral across locales.
 *
 * Plain U+0020 and not a thin space on purpose: PDFKit's built-in fonts use
 * WinAnsi encoding, which has no U+2009, so a thin space would render as the
 * wrong glyph on exactly the fonts that need no embedding.
 */
function formatTick (n) {
  const abs = Math.abs(n)
  let s
  if (abs >= 1000) s = Math.round(n).toString()
  else if (Number.isInteger(n)) s = n.toString()
  else s = n.toFixed(countDecimals(n))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function countDecimals (n) {
  const s = Math.abs(n).toString()
  const dot = s.indexOf('.')
  if (dot === -1) return 0
  return Math.min(4, s.length - dot - 1)
}

module.exports = { niceScale, niceStep, project, formatTick, round }
