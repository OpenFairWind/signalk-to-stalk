'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const MPS_TO_KNOTS = 1.9438444924406048

module.exports = () => ({
  datagram: '0x20', title: '0x20 Speed through water', keys: ['navigation.speedThroughWater'],
  f(value) {
    if (value == null) return undefined
    assertFinite(value, 'speedThroughWater')
    if (value < 0) throw new RangeError('speedThroughWater must not be negative')
    const encoded = Math.round(value * MPS_TO_KNOTS * 10)
    if (encoded > 0xffff) throw new RangeError('speedThroughWater exceeds the SeaTalk field capacity')
    return toDatagram([0x20, 0x01, encoded & 0xff, encoded >> 8])
  }
})
