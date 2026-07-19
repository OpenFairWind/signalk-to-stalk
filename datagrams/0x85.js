'use strict'
const { assertFinite, normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')

const METRES_PER_NAUTICAL_MILE = 1852

function encodeNavigation({ crossTrackError, bearing, distance, bearingTrue = false } = {}) {
  let xte = 0
  let xteLow = 0
  let bearingVU = 0
  let rangeZW = 0
  let rangeLow = 0
  let y = 0
  let flags = 0

  if (crossTrackError != null) {
    assertFinite(crossTrackError, 'crossTrackError')
    const xteHundredthsNm = Math.round(Math.abs(crossTrackError) / METRES_PER_NAUTICAL_MILE * 100)
    if (xteHundredthsNm > 0x0fff) throw new RangeError('crossTrackError exceeds the SeaTalk field capacity')
    xte = (xteHundredthsNm >> 8) & 0x0f
    xteLow = xteHundredthsNm & 0xff
    if (crossTrackError < 0) y |= 0x04
    flags |= 0x01
    if (xteHundredthsNm >= 30) flags |= 0x08
  }

  let rangeHigh = 0
  let bearingW = 0
  if (bearing != null) {
    assertFinite(bearing, 'bearing')
    const halfDegrees = Math.round(normalizeDegrees(radiansToDegrees(bearing)) * 2) % 720
    const quadrant = Math.floor(halfDegrees / 180)
    const withinQuadrant = halfDegrees % 180
    const u = quadrant | (bearingTrue ? 0x08 : 0)
    const v = withinQuadrant & 0x0f
    bearingW = (withinQuadrant >> 4) & 0x0f
    bearingVU = (v << 4) | u
    flags |= 0x02
  }

  if (distance != null) {
    assertFinite(distance, 'distance')
    if (distance < 0) throw new RangeError('distance must not be negative')
    const nauticalMiles = distance / METRES_PER_NAUTICAL_MILE
    let encoded
    if (nauticalMiles < 10) {
      encoded = Math.round(nauticalMiles * 100)
      y |= 0x01
    } else {
      encoded = Math.round(nauticalMiles * 10)
    }
    if (encoded > 0x0fff) throw new RangeError('distance exceeds the SeaTalk field capacity')
    rangeHigh = (encoded >> 8) & 0x0f
    rangeLow = encoded & 0xff
    flags |= 0x04
  }

  rangeZW = (rangeHigh << 4) | bearingW
  return [0x85, (xte << 4) | 0x06, xteLow, bearingVU, rangeZW, rangeLow, (y << 4) | flags, 0x00, 0x00]
}

module.exports = () => ({
  datagram: '0x85',
  title: '0x85 Navigation to waypoint',
  managed: true,
  f(values) { return toDatagram(encodeNavigation(values)) }
})

module.exports.encodeNavigation = encodeNavigation
module.exports.invalidNavigation = () => toDatagram(encodeNavigation({}))
