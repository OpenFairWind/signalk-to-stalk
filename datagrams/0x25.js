'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const METRES_PER_NAUTICAL_MILE = 1852

module.exports = () => ({
  datagram: '0x25', title: '0x25 Total and trip log', keys: ['navigation.log', 'navigation.trip.log'],
  f(totalMetres, tripMetres) {
    if (totalMetres == null || tripMetres == null) return undefined
    assertFinite(totalMetres, 'navigationLog'); assertFinite(tripMetres, 'tripLog')
    if (totalMetres < 0 || tripMetres < 0) throw new RangeError('log values must not be negative')
    const total = Math.round(totalMetres / METRES_PER_NAUTICAL_MILE * 10)
    const trip = Math.round(tripMetres / METRES_PER_NAUTICAL_MILE * 100)
    if (total > 0xfffff || trip > 0xfffff) throw new RangeError('log value exceeds the SeaTalk field capacity')
    const z = (total >> 16) & 0x0f
    const w = (trip >> 16) & 0x0f
    return toDatagram([0x25, (z << 4) | 0x04, total & 0xff, (total >> 8) & 0xff, trip & 0xff, (trip >> 8) & 0xff, w])
  }
})
