'use strict'
const { assertFinite, normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x53',
  title: '0x53 Magnetic course over ground',
  keys: ['navigation.courseOverGroundTrue', 'navigation.magneticVariation'],
  // No default variation: assuming 0 would falsely claim true and magnetic
  // course are equal. 0x53 waits until both values are available.
  f(courseTrue, variation) {
    if (courseTrue == null || variation == null) return undefined
    assertFinite(courseTrue, 'courseOverGroundTrue')
    assertFinite(variation, 'magneticVariation')
    const magnetic = normalizeDegrees(radiansToDegrees(courseTrue - variation))
    const halfDegrees = Math.round(magnetic * 2) % 720
    const quadrant = Math.floor(halfDegrees / 180)
    const withinQuadrant = halfDegrees % 180
    const twoDegreeSteps = Math.floor(withinQuadrant / 4)
    const halfDegreeRemainder = withinQuadrant % 4
    const u = quadrant | (halfDegreeRemainder << 2)
    const vw = twoDegreeSteps
    return toDatagram([0x53, (u << 4) | 0x00, vw])
  }
})
