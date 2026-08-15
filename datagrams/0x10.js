'use strict'
const { assertFinite, normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x10',
  title: '0x10 Apparent wind angle',
  keys: ['environment.wind.angleApparent'],
  f(angleRadians) {
    if (angleRadians == null) return undefined
    assertFinite(angleRadians, 'angleApparent')

    // Signal K uses negative angles to port. SeaTalk encodes the clockwise
    // angle right of the bow in half-degree increments.
    const degreesRightOfBow = normalizeDegrees(radiansToDegrees(angleRadians))
    const halfDegrees = Math.round(degreesRightOfBow * 2) % 720
    return toDatagram([0x10, 0x01, halfDegrees >> 8, halfDegrees & 0xff])
  }
})
