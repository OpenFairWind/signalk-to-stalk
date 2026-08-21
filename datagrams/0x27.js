'use strict'
const { assertFinite, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x27', title: '0x27 Water temperature', keys: ['environment.water.temperature'],
  f(kelvin) {
    if (kelvin == null) return undefined
    assertFinite(kelvin, 'waterTemperature')
    const encoded = Math.round((kelvin - 273.15) * 10 + 100)
    if (encoded < 0 || encoded > 0xffff) throw new RangeError('waterTemperature exceeds the SeaTalk field capacity')
    return toDatagram([0x27, 0x01, encoded & 0xff, encoded >> 8])
  }
})
