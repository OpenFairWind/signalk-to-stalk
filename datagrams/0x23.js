'use strict'
const { assertFinite, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x23', title: '0x23 ST50 water temperature', keys: ['environment.water.temperature'],
  f(kelvin) {
    if (kelvin == null) return undefined
    assertFinite(kelvin, 'waterTemperature')
    const celsius = kelvin - 273.15
    const wholeCelsius = Math.round(celsius)
    const wholeFahrenheit = Math.round(celsius * 9 / 5 + 32)
    if (wholeCelsius < 0 || wholeCelsius > 255 || wholeFahrenheit < 0 || wholeFahrenheit > 255) {
      throw new RangeError('waterTemperature is not representable by SeaTalk 0x23')
    }
    return toDatagram([0x23, 0x01, wholeCelsius, wholeFahrenheit])
  }
})
