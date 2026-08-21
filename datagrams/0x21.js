'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const METRES_PER_NAUTICAL_MILE = 1852

module.exports = () => ({
  datagram: '0x21', title: '0x21 Trip mileage', keys: ['navigation.trip.log'],
  f(value) {
    if (value == null) return undefined
    assertFinite(value, 'tripLog')
    if (value < 0) throw new RangeError('tripLog must not be negative')
    const encoded = Math.round(value / METRES_PER_NAUTICAL_MILE * 100)
    if (encoded > 0xfffff) throw new RangeError('tripLog exceeds the SeaTalk field capacity')
    return toDatagram([0x21, 0x02, encoded & 0xff, (encoded >> 8) & 0xff, (encoded >> 16) & 0x0f])
  }
})
