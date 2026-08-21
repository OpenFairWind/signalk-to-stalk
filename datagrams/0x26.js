'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const MPS_TO_KNOTS = 1.9438444924406048

module.exports = () => ({
  datagram: '0x26', title: '0x26 High-resolution speed through water', keys: ['navigation.speedThroughWater'],
  f(value) {
    if (value == null) return undefined
    assertFinite(value, 'speedThroughWater')
    if (value < 0) throw new RangeError('speedThroughWater must not be negative')
    const encoded = Math.round(value * MPS_TO_KNOTS * 100)
    if (encoded > 0xffff) throw new RangeError('speedThroughWater exceeds the SeaTalk field capacity')
    // D&4 marks sensor 1 current speed valid. The unavailable average field is zero.
    return toDatagram([0x26, 0x04, encoded & 0xff, encoded >> 8, 0x00, 0x00, 0x40])
  }
})
