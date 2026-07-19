'use strict'

function assertInteger(value, name, min = 0, max = 255) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`)
  return value
}

function toHexString(value) {
  return assertInteger(value, 'byte').toString(16).toUpperCase().padStart(2, '0')
}

function computeChecksum(sentence) {
  if (typeof sentence !== 'string' || sentence[0] !== '$') {
    throw new TypeError('sentence must be a string beginning with $')
  }
  let checksum = 0
  for (let i = 1; i < sentence.length; i += 1) checksum ^= sentence.charCodeAt(i)
  return `*${toHexString(checksum)}`
}

function toDatagram(bytes, options = {}) {
  if (!Array.isArray(bytes) || bytes.length < 2) throw new TypeError('bytes must be a non-empty array')
  const encoded = bytes.map((byte, index) => toHexString(assertInteger(byte, `bytes[${index}]`)))
  const base = `$STALK,${encoded.join(',')}`
  return `${base}${computeChecksum(base)}${options.terminate === false ? '' : '\r\n'}`
}

function normalizeDegrees(value) {
  assertFinite(value, 'angle')
  return ((value % 360) + 360) % 360
}

function radiansToDegrees(value) {
  return assertFinite(value, 'radians') * 180 / Math.PI
}

function encodeCoordinate(value, maxDegrees, positiveHemisphereBit) {
  assertFinite(value, 'coordinate')
  if (value < -maxDegrees || value > maxDegrees) {
    throw new RangeError(`coordinate must be between -${maxDegrees} and ${maxDegrees}`)
  }

  const positive = value >= 0
  const absolute = Math.abs(value)
  let degrees = Math.floor(absolute)
  let hundredthsOfMinute = Math.round((absolute - degrees) * 60 * 100)
  if (hundredthsOfMinute === 6000) {
    degrees += 1
    hundredthsOfMinute = 0
  }
  if (degrees > maxDegrees || (degrees === maxDegrees && hundredthsOfMinute !== 0)) {
    throw new RangeError('coordinate rounds outside its valid range')
  }

  const hemisphereSet = positiveHemisphereBit ? positive : !positive
  const minutes = hundredthsOfMinute | (hemisphereSet ? 0x8000 : 0)
  return [degrees, minutes & 0xff, (minutes >> 8) & 0xff]
}

function parseDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('datetime must be a valid ISO-8601 value or Date')
  return date
}

module.exports = {
  assertFinite,
  assertInteger,
  computeChecksum,
  encodeCoordinate,
  normalizeDegrees,
  parseDate,
  radiansToDegrees,
  toDatagram,
  toHexString
}
