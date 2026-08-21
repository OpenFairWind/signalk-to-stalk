'use strict'

const { assertFinite, assertInteger, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x57',
  title: '0x57 GNSS satellites and HDOP',
  keys: ['navigation.gnss.satellites', 'navigation.gnss.horizontalDilution'],
  f(satellites, horizontalDilution) {
    if (satellites == null || horizontalDilution == null) return undefined

    assertInteger(satellites, 'satellites', 0, 15)
    assertFinite(horizontalDilution, 'horizontalDilution')
    if (horizontalDilution < 0 || horizontalDilution > 25.5) {
      throw new RangeError('horizontalDilution must be between 0 and 25.5')
    }

    return toDatagram([0x57, satellites << 4, Math.round(horizontalDilution * 10)])
  }
})
