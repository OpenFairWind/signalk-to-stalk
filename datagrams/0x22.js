'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const METRES_PER_NAUTICAL_MILE = 1852

module.exports = () => ({
  datagram: '0x22', title: '0x22 Total mileage', keys: ['navigation.log'],
  f(value) {
    if (value == null) return undefined
    assertFinite(value, 'navigationLog')
    if (value < 0) throw new RangeError('navigationLog must not be negative')
    const encoded = Math.round(value / METRES_PER_NAUTICAL_MILE * 10)
    if (encoded > 0xffff) throw new RangeError('navigationLog exceeds the SeaTalk field capacity')
    return toDatagram([0x22, 0x02, encoded & 0xff, encoded >> 8, 0x00])
  }
})
