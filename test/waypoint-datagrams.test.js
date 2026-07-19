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
  assert.deepEqual(bytes(sentence), [0x85, 0x06, 0x64, 0xa0, 0x25, 0x26, 0x1f, 0x00, 0x00])
})

test('0x85 encodes true bearing, steer-right direction and long range', () => {
  const sentence = create85().f({
    crossTrackError: -0.5 * 1852,
    bearing: Math.PI,
    distance: 12 * 1852,
    bearingTrue: true
  })
  assert.deepEqual(bytes(sentence), [0x85, 0x06, 0x32, 0x0a, 0x00, 0x78, 0x4f, 0x00, 0x00])
})

test('0x85 invalid navigation clears all validity flags', () => {
  assert.deepEqual(bytes(create85.invalidNavigation()), [0x85, 0x06, 0, 0, 0, 0, 0, 0, 0])
})
