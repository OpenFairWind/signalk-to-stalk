'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const create82 = require('../datagrams/0x82')
const create85 = require('../datagrams/0x85')

function bytes(sentence) {
  return sentence.slice(7, sentence.indexOf('*')).split(',').map(value => parseInt(value, 16))
}

test('0x82 encodes verified four-character waypoint vectors', () => {
  assert.deepEqual(bytes(create82().f('WPT1')), [0x82, 0x05, 0x27, 0xd8, 0x48, 0xb7, 0x06, 0xf9])
  assert.deepEqual(bytes(create82().f('AB')), [0x82, 0x05, 0x91, 0x6e, 0x04, 0xfb, 0x00, 0xff])
})

test('0x82 normalizes unsupported and long waypoint names deterministically', () => {
  assert.equal(create82.normalizeWaypointName('marina-12'), 'A_12')
})

test('0x85 encodes XTE, magnetic bearing and short range', () => {
  const sentence = create85().f({
    crossTrackError: 1852,
    bearing: 45 * Math.PI / 180,
    distance: 5.5 * 1852,
    bearingTrue: false
  })
  assert.deepEqual(bytes(sentence), [0x85, 0x46, 0x06, 0xa0, 0x65, 0x22, 0x15, 0x00, 0xea])
})

test('0x85 encodes true bearing, steer-right direction and long range', () => {
  const sentence = create85().f({
    crossTrackError: -0.5 * 1852,
    bearing: Math.PI,
    distance: 12 * 1852,
    bearingTrue: true
  })
  assert.deepEqual(bytes(sentence), [0x85, 0x26, 0x03, 0x0a, 0x80, 0x07, 0x45, 0x00, 0xba])
})

test('0x85 rejects partial navigation that would produce SeaTalk data errors', () => {
  assert.throws(() => create85().f({ distance: 100 }), /required/)
})

test('0x85 encodes the captured Freeboard course values as passive mode 5 with complement', () => {
  const sentence = create85().f({
    crossTrackError: 456.05256735914895,
    bearing: 2.3217204599612637,
    distance: 29183.703544192125,
    bearingTrue: false
  })
  assert.deepEqual(bytes(sentence), [0x85, 0x96, 0x01, 0x61, 0xe5, 0x09, 0x05, 0x00, 0xfa])
})

test('0x85 selects long-range resolution after rounding at 10 nm', () => {
  const bytes = create85.encodeNavigation({ crossTrackError: 0, bearing: 0, distance: 9.995 * 1852, bearingTrue: true })
  assert.equal((bytes[6] >> 4) & 1, 0)
  assert.equal((bytes[5] << 4) | (bytes[4] >> 4), 100)
})

test('0x85 matches the Knauf worked examples for XTE, bearing and distance nibble order', () => {
  // Knauf: XTE 2.61 nm = 0x105 => X6 XX = 56 10; bearing 230 deg => VU ZW = 42 _6;
  // distance 5.13 nm = 0x201 => ZW ZZ YF = 1_ 20 1_; 51.3 nm = 0x201 => 1_ 20 0_.
  const short = create85.encodeNavigation({ crossTrackError: 2.61 * 1852, bearing: 230 * Math.PI / 180, distance: 5.13 * 1852 })
  assert.deepEqual(short, [0x85, 0x56, 0x10, 0x42, 0x16, 0x20, 0x15, 0x00, 0xea])
  const long = create85.encodeNavigation({ crossTrackError: 2.61 * 1852, bearing: 230 * Math.PI / 180, distance: 51.3 * 1852 })
  assert.deepEqual(long.slice(4, 7), [0x16, 0x20, 0x05])
})

test('0x85 places every XTE and distance bit at its documented position', () => {
  const maximum = create85.encodeNavigation({ crossTrackError: 40.95 * 1852, bearing: 0, distance: 409.5 * 1852 })
  assert.equal(((maximum[2] << 4) | (maximum[1] >> 4)), 0x0fff)
  assert.equal(((maximum[5] << 4) | (maximum[4] >> 4)), 0x0fff)
  assert.equal(maximum[1] & 0x0f, 0x06)
  assert.throws(() => create85.encodeNavigation({ crossTrackError: 40.96 * 1852, bearing: 0, distance: 0 }), /crossTrackError/)
  assert.throws(() => create85.encodeNavigation({ crossTrackError: 0, bearing: 0, distance: 409.6 * 1852 }), /distance/)
})
