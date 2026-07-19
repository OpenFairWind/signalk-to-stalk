'use strict'
const { assertFinite, normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x53',
  title: '0x53 Magnetic course over ground',
  keys: ['navigation.courseOverGroundTrue', 'navigation.magneticVariation'],
  defaults: [undefined, 0],
  f(courseTrue, variation = 0) {
    if (courseTrue == null) return undefined
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
