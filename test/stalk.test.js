'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { computeChecksum, encodeCoordinate, toDatagram, toHexString } = require('../stalk')

test('formats bytes and computes an NMEA checksum', () => {
  assert.equal(toHexString(0), '00')
  assert.equal(toHexString(255), 'FF')
  assert.equal(computeChecksum('$STALK,52,01,64,00'), '*45')
  assert.equal(toDatagram([0x52, 0x01, 0x64, 0x00]), '$STALK,52,01,64,00*45\r\n')
})

test('coordinate encoding handles hemispheres and minute rollover', () => {
  assert.deepEqual(encodeCoordinate(40.5, 90, false), [40, 0xb8, 0x0b])
  assert.deepEqual(encodeCoordinate(-40.5, 90, false), [40, 0xb8, 0x8b])
  assert.deepEqual(encodeCoordinate(14.25, 180, true), [14, 0xdc, 0x85])
  assert.deepEqual(encodeCoordinate(40.9999999, 90, false), [41, 0x00, 0x00])
})

test('rejects invalid bytes and coordinates', () => {
  assert.throws(() => toHexString(256), RangeError)
  assert.throws(() => encodeCoordinate(91, 90, false), RangeError)
})
