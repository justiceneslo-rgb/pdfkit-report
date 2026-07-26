'use strict'

/**
 * Visual defaults. Every value can be overridden per report via spec.theme,
 * which is merged one level deep so you can override a single colour without
 * restating the whole palette.
 */
const DEFAULT_THEME = {
  font: 'Helvetica',
  fontBold: 'Helvetica-Bold',
  fontItalic: 'Helvetica-Oblique',

  size: {
    h1: 19,
    h2: 13.5,
    h3: 11,
    body: 10,
    table: 9.5,
    small: 8.5,
    caption: 8
  },

  color: {
    text: '#1A1A1A',
    muted: '#6B7280',
    line: '#E2E2DC',
    accent: '#1B4332',
    band: '#F6F6F2',
    headBand: '#F0F0EA',
    white: '#FFFFFF',
    negative: '#9B2C2C',
    positive: '#1B4332',
    grid: '#EDEDE7',
    series: ['#1B4332', '#C9A84C', '#9B2C2C', '#2D6A4F', '#6B7280', '#C08A6A']
  },

  gap: {
    block: 16,
    afterHeading: 8,
    paragraph: 5,
    cellPadX: 6,
    cellPadY: 5
  },

  rule: {
    thin: 0.5,
    medium: 1,
    thick: 1.6
  }
}

/**
 * Merge user overrides one level deep. Arrays (series colours) are replaced
 * wholesale, never concatenated, so a caller can shorten the palette.
 */
function buildTheme (overrides) {
  const out = {}
  for (const key of Object.keys(DEFAULT_THEME)) {
    const base = DEFAULT_THEME[key]
    const over = overrides && overrides[key]
    if (base && typeof base === 'object' && !Array.isArray(base)) {
      out[key] = Object.assign({}, base, over || {})
    } else {
      out[key] = over === undefined ? base : over
    }
  }
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      if (!(key in out)) out[key] = overrides[key]
    }
  }
  return out
}

module.exports = { DEFAULT_THEME, buildTheme }
