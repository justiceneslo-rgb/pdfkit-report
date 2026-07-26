'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { niceScale, niceStep, project, formatTick } = require('../src/scale')

test('niceStep rounds up to 1, 2, 2.5 or 5 times a power of ten', () => {
  assert.equal(niceStep(0.9), 1)
  assert.equal(niceStep(1.4), 2)
  assert.equal(niceStep(2.3), 2.5)
  assert.equal(niceStep(4.1), 5)
  assert.equal(niceStep(7), 10)
  assert.equal(niceStep(23), 25)
  assert.equal(niceStep(180), 200)
})

test('niceScale covers the data and lands on round ticks', () => {
  const s = niceScale(0, 93)
  assert.ok(s.min <= 0, 'lower bound covers the data')
  assert.ok(s.max >= 93, 'upper bound covers the data')
  for (const t of s.ticks) {
    assert.equal(Math.round(t / s.step) * s.step, t, `tick ${t} is a multiple of the step`)
  }
})

test('niceScale keeps ticks free of floating point dust', () => {
  const s = niceScale(0, 1)
  for (const t of s.ticks) {
    assert.equal(t, Number(t.toPrecision(12)), `tick ${t} is clean`)
  }
  assert.deepEqual(niceScale(0, 0.5, 5).ticks.includes(0.3), true)
})

test('niceScale handles a flat series without collapsing the axis', () => {
  const zero = niceScale(0, 0)
  assert.ok(zero.max > zero.min, 'a zero series still gets a readable axis')

  const flat = niceScale(42, 42)
  assert.ok(flat.max > flat.min)
  assert.ok(flat.min <= 42 && flat.max >= 42)

  const negative = niceScale(-7, -7)
  assert.ok(negative.min <= -7 && negative.max >= -7)
})

test('niceScale spans zero for mixed signs', () => {
  const s = niceScale(-30, 45)
  assert.ok(s.min <= -30)
  assert.ok(s.max >= 45)
  assert.ok(s.ticks.includes(0), 'a mixed-sign axis has a zero line')
})

test('niceScale accepts a reversed range', () => {
  assert.deepEqual(niceScale(100, 0), niceScale(0, 100))
})

test('niceScale rejects non-finite input', () => {
  assert.throws(() => niceScale(NaN, 10), TypeError)
  assert.throws(() => niceScale(0, Infinity), TypeError)
})

test('project maps the scale bounds onto the full pixel length', () => {
  const s = niceScale(0, 100)
  assert.equal(project(s.min, s, 200), 0)
  assert.equal(project(s.max, s, 200), 200)
  assert.equal(project((s.min + s.max) / 2, s, 200), 100)
})

test('project is linear across the axis', () => {
  const s = niceScale(-50, 50)
  const a = project(-25, s, 100)
  const b = project(0, s, 100)
  const c = project(25, s, 100)
  assert.ok(Math.abs((b - a) - (c - b)) < 1e-9, 'equal value steps give equal pixel steps')
})

test('formatTick keeps labels short and readable', () => {
  assert.equal(formatTick(1000), '1 000')
  assert.equal(formatTick(12), '12')
  assert.equal(formatTick(0.5), '0.5')
  assert.equal(formatTick(-2500), '-2 500')
})
