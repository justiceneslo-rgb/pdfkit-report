'use strict'

const { niceScale, project, formatTick } = require('../scale')

/**
 * Charts drawn directly into the PDF as vectors: no image rendering, no
 * charting library, no fonts beyond the ones already embedded.
 *
 * All three types share one frame (value axis on the left, gridlines, category
 * axis at the bottom) so a report mixing them stays visually consistent.
 *
 * A chart is atomic: it never splits across a page. If it does not fit in the
 * space left it moves to the next page whole.
 */

const DEFAULT_HEIGHT = 170

function chartGeometry (L, block) {
  const { doc, theme } = L
  const plotHeight = block.height || DEFAULT_HEIGHT
  const titleHeight = block.title
    ? doc.font(theme.fontBold).fontSize(theme.size.h3).heightOfString(String(block.title), { width: L.width }) + 6
    : 0
  const captionHeight = block.caption
    ? doc.font(theme.font).fontSize(theme.size.caption).heightOfString(String(block.caption), { width: L.width }) + 8
    : 0
  const axisLabelHeight = theme.size.caption * 1.8
  return { plotHeight, titleHeight, captionHeight, axisLabelHeight, total: titleHeight + plotHeight + axisLabelHeight + captionHeight }
}

function drawTitle (L, block, geom) {
  if (!block.title) return
  const { doc, theme } = L
  doc.font(theme.fontBold).fontSize(theme.size.h3).fillColor(theme.color.text)
    .text(String(block.title), L.x, L.y, { width: L.width, height: geom.titleHeight })
  L.move(geom.titleHeight)
}

function drawCaption (L, block, geom) {
  if (!block.caption) return
  const { doc, theme } = L
  doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
    .text(String(block.caption), L.x, L.y + 8, { width: L.width, height: geom.captionHeight })
  L.move(geom.captionHeight)
}

/**
 * Draw the value axis and gridlines, and return the plot rectangle that the
 * data marks may use.
 */
function drawFrame (L, scale, plotTop, plotHeight, opts) {
  const { doc, theme } = L
  const labels = scale.ticks.map(t => (opts.format ? opts.format(t) : formatTick(t)))

  doc.font(theme.font).fontSize(theme.size.caption)
  let labelWidth = 0
  for (const label of labels) {
    const w = doc.widthOfString(label)
    if (w > labelWidth) labelWidth = w
  }

  const gutter = labelWidth + 8
  const plotX = L.x + gutter
  const plotWidth = L.width - gutter
  const plotBottom = plotTop + plotHeight

  for (let i = 0; i < scale.ticks.length; i++) {
    const y = plotBottom - project(scale.ticks[i], scale, plotHeight)
    const isBase = scale.ticks[i] === 0 && scale.min < 0
    doc.save()
      .lineWidth(isBase ? theme.rule.medium : theme.rule.thin)
      .strokeColor(isBase ? theme.color.muted : theme.color.grid)
      .moveTo(plotX, y).lineTo(plotX + plotWidth, y).stroke().restore()

    doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
      .text(labels[i], L.x, y - theme.size.caption * 0.72, {
        width: labelWidth, height: theme.size.caption * 1.4, align: 'right', lineBreak: false
      })
  }

  doc.save().lineWidth(theme.rule.medium).strokeColor(theme.color.muted)
    .moveTo(plotX, plotTop).lineTo(plotX, plotBottom).stroke().restore()

  return { x: plotX, y: plotTop, width: plotWidth, height: plotHeight, bottom: plotBottom }
}

/** Category labels under the plot, clipped to their slot so they never collide. */
function drawCategoryLabels (L, plot, items, slotWidth) {
  const { doc, theme } = L
  doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
  for (let i = 0; i < items.length; i++) {
    const label = String(items[i].label == null ? '' : items[i].label)
    if (!label) continue
    doc.text(label, plot.x + i * slotWidth, plot.bottom + 4, {
      width: slotWidth,
      height: theme.size.caption * 1.5,
      align: 'center',
      lineBreak: false,
      ellipsis: true
    })
  }
}

function seriesColor (theme, index, explicit) {
  if (explicit) return explicit
  return theme.color.series[index % theme.color.series.length]
}

/**
 * Vertical bar chart.
 * block = { type:'bar', data:[{label, value, color}], height, format, target }
 */
function renderBar (L, block) {
  const { doc, theme } = L
  const data = (block.data || []).filter(d => d && Number.isFinite(Number(d.value)))
    .map(d => ({ label: d.label, value: Number(d.value), color: d.color }))

  const geom = chartGeometry(L, block)
  L.space(Math.min(geom.total, L.pageCapacity), 'chart')
  drawTitle(L, block, geom)

  if (data.length === 0) {
    L.record({ type: 'chart', chart: 'bar', points: 0, empty: true })
    L.move(theme.gap.paragraph)
    return
  }

  const values = data.map(d => d.value)
  if (block.target !== undefined) values.push(Number(block.target))
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values), block.ticks || 4)

  const plot = drawFrame(L, scale, L.y, geom.plotHeight, { format: block.format })
  const slot = plot.width / data.length
  const barWidth = Math.max(2, slot * (block.barRatio || 0.55))
  const zeroY = plot.bottom - project(0, scale, plot.height)

  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const valueY = plot.bottom - project(d.value, scale, plot.height)
    const top = Math.min(valueY, zeroY)
    const height = Math.abs(valueY - zeroY)
    const x = plot.x + i * slot + (slot - barWidth) / 2
    // One series, one colour. Cycling the palette per bar turns a single
    // measurement into what reads as six unrelated ones. Set colorByPoint
    // when the categories really are independent.
    const fill = d.color || block.color ||
      (block.colorByPoint ? seriesColor(theme, i) : theme.color.series[0])
    doc.save().fillColor(fill)
      .rect(x, top, barWidth, Math.max(height, 0.6)).fill().restore()

    if (block.valueLabels) {
      const label = block.format ? block.format(d.value) : formatTick(d.value)
      doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
        .text(label, plot.x + i * slot, top - theme.size.caption * 1.35, {
          width: slot, height: theme.size.caption * 1.3, align: 'center', lineBreak: false
        })
    }
  }

  if (block.target !== undefined && Number.isFinite(Number(block.target))) {
    const ty = plot.bottom - project(Number(block.target), scale, plot.height)
    doc.save().lineWidth(theme.rule.medium).strokeColor(block.targetColor || theme.color.negative)
      .dash(3, { space: 2 }).moveTo(plot.x, ty).lineTo(plot.x + plot.width, ty).stroke()
      .undash().restore()
  }

  drawCategoryLabels(L, plot, data, slot)
  L.record({ type: 'chart', chart: 'bar', points: data.length, scale: { min: scale.min, max: scale.max, step: scale.step } })
  L.move(geom.plotHeight + geom.axisLabelHeight)
  drawCaption(L, block, geom)
  L.move(theme.gap.paragraph)
}

/**
 * Deviation chart: bars running up or down from a baseline, coloured by sign.
 * block = { type:'delta', data:[{label, value}], baseline, height }
 */
function renderDelta (L, block) {
  const { doc, theme } = L
  const baseline = Number.isFinite(Number(block.baseline)) ? Number(block.baseline) : 0
  const data = (block.data || []).filter(d => d && Number.isFinite(Number(d.value)))
    .map(d => ({ label: d.label, value: Number(d.value) - baseline, raw: Number(d.value), color: d.color }))

  const geom = chartGeometry(L, block)
  L.space(Math.min(geom.total, L.pageCapacity), 'chart')
  drawTitle(L, block, geom)

  if (data.length === 0) {
    L.record({ type: 'chart', chart: 'delta', points: 0, empty: true })
    L.move(theme.gap.paragraph)
    return
  }

  const values = data.map(d => d.value)
  const span = Math.max(Math.abs(Math.min(...values)), Math.abs(Math.max(...values)))
  const scale = niceScale(-span, span, block.ticks || 4)

  const plot = drawFrame(L, scale, L.y, geom.plotHeight, { format: block.format })
  const slot = plot.width / data.length
  const barWidth = Math.max(2, slot * (block.barRatio || 0.5))
  const zeroY = plot.bottom - project(0, scale, plot.height)

  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const valueY = plot.bottom - project(d.value, scale, plot.height)
    const top = Math.min(valueY, zeroY)
    const height = Math.max(Math.abs(valueY - zeroY), 0.6)
    const x = plot.x + i * slot + (slot - barWidth) / 2
    const color = d.color || (d.value < 0 ? theme.color.negative : theme.color.positive)
    doc.save().fillColor(color).rect(x, top, barWidth, height).fill().restore()
  }

  drawCategoryLabels(L, plot, data, slot)
  L.record({ type: 'chart', chart: 'delta', points: data.length, baseline, scale: { min: scale.min, max: scale.max, step: scale.step } })
  L.move(geom.plotHeight + geom.axisLabelHeight)
  drawCaption(L, block, geom)
  L.move(theme.gap.paragraph)
}

/**
 * Scatter plot with one or more series.
 * block = { type:'scatter', series:[{name, color, points:[{x,y}]}], height }
 * A bare `points` array is accepted as a single unnamed series.
 */
function renderScatter (L, block) {
  const { doc, theme } = L
  const series = normaliseSeries(block)

  const geom = chartGeometry(L, block)
  // The topmost axis label sits half a line above the plot, so the legend needs
  // clearance under it or the two collide.
  const legendHeight = series.some(s => s.name) ? theme.size.caption * 1.8 + 5 : 0
  L.space(Math.min(geom.total + legendHeight, L.pageCapacity), 'chart')
  drawTitle(L, block, geom)

  const all = series.flatMap(s => s.points)
  if (all.length === 0) {
    L.record({ type: 'chart', chart: 'scatter', points: 0, empty: true })
    L.move(theme.gap.paragraph)
    return
  }

  if (legendHeight) drawLegend(L, series, legendHeight)

  const yScale = niceScale(Math.min(...all.map(p => p.y)), Math.max(...all.map(p => p.y)), block.ticks || 4)
  const xMin = Math.min(...all.map(p => p.x))
  const xMax = Math.max(...all.map(p => p.x))
  const xScale = niceScale(xMin, xMax, block.xTicks || 4)

  const plot = drawFrame(L, yScale, L.y, geom.plotHeight, { format: block.format })

  doc.save().lineWidth(theme.rule.medium).strokeColor(theme.color.muted)
    .moveTo(plot.x, plot.bottom).lineTo(plot.x + plot.width, plot.bottom).stroke().restore()

  const radius = block.radius || 2.4
  for (let s = 0; s < series.length; s++) {
    const color = seriesColor(theme, s, series[s].color)
    doc.save().fillColor(color).fillOpacity(block.opacity === undefined ? 0.85 : block.opacity)
    for (const p of series[s].points) {
      const px = plot.x + project(p.x, xScale, plot.width)
      const py = plot.bottom - project(p.y, yScale, plot.height)
      doc.circle(px, py, radius).fill()
    }
    doc.restore()
  }

  doc.font(theme.font).fontSize(theme.size.caption).fillColor(theme.color.muted)
  doc.text(formatTick(xScale.min), plot.x, plot.bottom + 4, { width: plot.width / 2, height: theme.size.caption * 1.4, lineBreak: false })
  doc.text(formatTick(xScale.max), plot.x + plot.width / 2, plot.bottom + 4, { width: plot.width / 2, height: theme.size.caption * 1.4, align: 'right', lineBreak: false })

  L.record({
    type: 'chart',
    chart: 'scatter',
    points: all.length,
    series: series.length,
    scale: { min: yScale.min, max: yScale.max, step: yScale.step }
  })
  L.move(geom.plotHeight + geom.axisLabelHeight)
  drawCaption(L, block, geom)
  L.move(theme.gap.paragraph)
}

function normaliseSeries (block) {
  const clean = points => (points || [])
    .map(p => Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p.x), y: Number(p.y) })
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))

  if (Array.isArray(block.series)) {
    return block.series.map(s => ({ name: s.name, color: s.color, points: clean(s.points) }))
  }
  return [{ name: undefined, color: block.color, points: clean(block.points) }]
}

function drawLegend (L, series, height) {
  const { doc, theme } = L
  let x = L.x
  doc.font(theme.font).fontSize(theme.size.caption)
  for (let i = 0; i < series.length; i++) {
    const name = series[i].name || `Series ${i + 1}`
    const color = seriesColor(theme, i, series[i].color)
    const w = doc.widthOfString(name)
    if (x + w + 18 > L.x + L.width) break
    doc.save().fillColor(color).rect(x, L.y + 2, 7, 7).fill().restore()
    doc.fillColor(theme.color.muted).text(name, x + 11, L.y, { width: w + 2, height: height, lineBreak: false })
    x += w + 22
  }
  L.move(height)
}

module.exports = { renderBar, renderDelta, renderScatter, chartGeometry }
