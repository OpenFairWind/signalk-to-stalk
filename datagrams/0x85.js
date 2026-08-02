'use strict'
const { normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')

const METRES_PER_NAUTICAL_MILE = 1852

function encodeNavigation({ crossTrackError, bearing, distance, bearingTrue = false } = {}) {
  if (![crossTrackError, bearing, distance].every(Number.isFinite)) {
    throw new TypeError('crossTrackError, bearing, and distance are required for a valid 0x85 datagram')
  }
  let xte = 0
  let xteLow = 0
  let bearingVU = 0
  let rangeZW = 0
  let rangeLow = 0
  let y = 0
  // Mode 5 displays XTE, range, and bearing without requesting autopilot track control.
  const trackControlMode = 0x05

  {
    const xteHundredthsNm = Math.round(Math.abs(crossTrackError) / METRES_PER_NAUTICAL_MILE * 100)
    if (xteHundredthsNm > 0x0fff) throw new RangeError('crossTrackError exceeds the SeaTalk field capacity')
    xte = (xteHundredthsNm >> 8) & 0x0f
    xteLow = xteHundredthsNm & 0xff
    if (crossTrackError < 0) y |= 0x04
  }

  let rangeHigh = 0
  let bearingW = 0
  {
    const halfDegrees = Math.round(normalizeDegrees(radiansToDegrees(bearing)) * 2) % 720
    const quadrant = Math.floor(halfDegrees / 180)
    const withinQuadrant = halfDegrees % 180
    const u = quadrant | (bearingTrue ? 0x08 : 0)
    const v = withinQuadrant & 0x0f
    bearingW = (withinQuadrant >> 4) & 0x0f
    bearingVU = (v << 4) | u
  }

  {
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
  }

  rangeZW = (rangeHigh << 4) | bearingW
  const yf = (y << 4) | trackControlMode
  return [0x85, (xte << 4) | 0x06, xteLow, bearingVU, rangeZW, rangeLow, yf, 0x00, 0xff - yf]
}

module.exports = () => ({
  datagram: '0x85',
  title: '0x85 Navigation to waypoint',
  managed: true,
  f(values) { return toDatagram(encodeNavigation(values)) }
})

module.exports.encodeNavigation = encodeNavigation
