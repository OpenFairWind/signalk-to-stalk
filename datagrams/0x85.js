'use strict'
const { normalizeDegrees, radiansToDegrees, toDatagram } = require('../stalk')

const METRES_PER_NAUTICAL_MILE = 1852

function encodeNavigation({ crossTrackError, bearing, distance, bearingTrue = false } = {}) {
  if (![crossTrackError, bearing, distance].every(Number.isFinite)) {
    throw new TypeError('crossTrackError, bearing, and distance are required for a valid 0x85 datagram')
  }
  let xte = 0
  let xteHigh = 0
  let bearingVU = 0
  let rangeZW = 0
  let y = 0
  // Knauf F=0x5 displays XTE, distance, and bearing without entering Track
  // Control Mode (F=0x3/0x7/0xF lock the autopilot on to GPS and are never sent).
  const trackControlMode = 0x05

  {
    const xteHundredthsNm = Math.round(Math.abs(crossTrackError) / METRES_PER_NAUTICAL_MILE * 100)
    if (xteHundredthsNm > 0x0fff) throw new RangeError('crossTrackError exceeds the SeaTalk field capacity')
    // Knauf: XXX is split as the X nibble (least-significant 4 bits) followed
    // by the XX byte (most-significant 8 bits): 0x105 => X6 XX = 56 10.
    xte = xteHundredthsNm & 0x0f
    xteHigh = (xteHundredthsNm >> 4) & 0xff
    if (crossTrackError < 0) y |= 0x04
  }

  let rangeNibble = 0
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
    const hundredths = Math.round((nauticalMiles + 1e-12) * 100)
    if (hundredths < 1000) {
      encoded = hundredths
      y |= 0x01
    } else {
      encoded = Math.round(nauticalMiles * 10)
    }
    if (encoded > 0x0fff) throw new RangeError('distance exceeds the SeaTalk field capacity')
    // Knauf: ZZZ is split as the Z nibble of ZW (least-significant 4 bits)
    // followed by the ZZ byte (most-significant 8 bits): 0x201 => ZW ZZ = 1W 20.
    rangeNibble = encoded & 0x0f
    rangeHigh = (encoded >> 4) & 0xff
  }

  rangeZW = (rangeNibble << 4) | bearingW
  const yf = (y << 4) | trackControlMode
  return [0x85, (xte << 4) | 0x06, xteHigh, bearingVU, rangeZW, rangeHigh, yf, 0x00, 0xff - yf]
}

module.exports = () => ({
  datagram: '0x85',
  title: '0x85 Navigation to waypoint',
  managed: true,
  f(values) { return toDatagram(encodeNavigation(values)) }
})

module.exports.encodeNavigation = encodeNavigation
