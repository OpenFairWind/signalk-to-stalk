'use strict'

const { assertFinite, radiansToDegrees, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x99',
  title: '0x99 Compass variation',
  keys: ['navigation.magneticVariation'],
  f(variation) {
    if (variation == null) return undefined

    assertFinite(variation, 'magneticVariation')
    const degreesEast = radiansToDegrees(variation)
    if (degreesEast < -30 || degreesEast > 30) {
      throw new RangeError('magneticVariation must be between 30 degrees west and 30 degrees east')
    }

    // Signal K is east-positive; SeaTalk command 0x99 is west-positive.
    return toDatagram([0x99, 0x00, Math.round(-degreesEast) & 0xff])
  }
})
