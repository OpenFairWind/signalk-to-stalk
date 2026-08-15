'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')

const encoder = name => require(`../datagrams/${name}`)().f
const payload = sentence => sentence.slice(0, sentence.indexOf('*'))

test('0x10 converts Signal K apparent wind angles to degrees right of bow', () => {
  const f = encoder('0x10')
  assert.equal(payload(f(0)), '$STALK,10,01,00,00')
  assert.equal(payload(f(5 * Math.PI / 180)), '$STALK,10,01,00,0A')
  assert.equal(payload(f(-5 * Math.PI / 180)), '$STALK,10,01,02,C6')
  assert.equal(payload(f(359.9 * Math.PI / 180)), '$STALK,10,01,00,00')
})

test('0x11 converts Signal K apparent wind speed to knots and tenths', () => {
  const f = encoder('0x11')
  assert.equal(payload(f(0)), '$STALK,11,01,00,00')
  assert.equal(payload(f(7.253668504262688)), '$STALK,11,01,0E,01')
  assert.throws(() => f(-1), RangeError)
  assert.throws(() => f(100), RangeError)
})

test('0x50 encodes latitude with South flag', () => {
  assert.equal(payload(encoder('0x50')({ latitude: -40.5 })), '$STALK,50,02,28,B8,8B')
})

test('0x51 encodes longitude with East flag', () => {
  assert.equal(payload(encoder('0x51')({ longitude: 14.25 })), '$STALK,51,02,0E,DC,85')
})

test('0x52 converts Signal K m/s to tenths of a knot', () => {
  assert.equal(payload(encoder('0x52')(10)), '$STALK,52,01,C2,00')
})

test('0x53 round-trips representative magnetic courses', () => {
  const f = encoder('0x53')
  const cases = [
    [0, '$STALK,53,00,00'],
    [1.5, '$STALK,53,C0,00'],
    [90, '$STALK,53,10,00'],
    [123.5, '$STALK,53,D0,10'],
    [359.5, '$STALK,53,F0,2C']
  ]
  for (const [degrees, expected] of cases) {
    assert.equal(payload(f(degrees * Math.PI / 180, 0)), expected)
  }
})

test('0x53 applies magnetic variation and normalizes negative angles', () => {
  const result = encoder('0x53')(0, 10 * Math.PI / 180)
  assert.equal(payload(result), '$STALK,53,30,28')
})

test('0x54 packs UTC time according to Knauf command 54', () => {
  assert.equal(payload(encoder('0x54')('2026-07-19T12:34:56Z')), '$STALK,54,81,8B,0C')
})

test('0x56 packs UTC date and enforces representable years', () => {
  assert.equal(payload(encoder('0x56')('2026-07-19T12:34:56Z')), '$STALK,56,71,13,1A')
  assert.throws(() => encoder('0x56')('1999-01-01T00:00:00Z'), RangeError)
})

test('0x57 packs satellite count and HDOP in tenths', () => {
  assert.equal(payload(encoder('0x57')(9, 0.7)), '$STALK,57,90,07')
  assert.equal(payload(encoder('0x57')(1, 14.8)), '$STALK,57,10,94')
  assert.throws(() => encoder('0x57')(16, 0.7), RangeError)
  assert.throws(() => encoder('0x57')(9, 25.6), RangeError)
})

test('0x99 converts Signal K east-positive variation to SeaTalk west-positive whole degrees', () => {
  assert.equal(payload(encoder('0x99')(-15.88 * Math.PI / 180)), '$STALK,99,00,10')
  assert.equal(payload(encoder('0x99')(4.6 * Math.PI / 180)), '$STALK,99,00,FB')
  assert.throws(() => encoder('0x99')(31 * Math.PI / 180), RangeError)
})

test('encoders ignore unavailable values and reject malformed values', () => {
  assert.equal(encoder('0x10')(null), undefined)
  assert.equal(encoder('0x11')(null), undefined)
  assert.equal(encoder('0x50')(null), undefined)
  assert.equal(encoder('0x57')(null, 0.7), undefined)
  assert.equal(encoder('0x99')(null), undefined)
  assert.throws(() => encoder('0x52')(-1), RangeError)
  assert.throws(() => encoder('0x54')('not-a-date'), TypeError)
})
