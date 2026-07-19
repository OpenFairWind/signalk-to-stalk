'use strict'
const { assertInteger, toDatagram } = require('../stalk')

const LEVEL_CODES = Object.freeze([0x00, 0x04, 0x08, 0x0c])

function encodeLampIntensity(level) {
  assertInteger(level, 'lamp intensity level', 0, 3)
  return [0x30, 0x00, LEVEL_CODES[level]]
}

module.exports = () => ({
  datagram: '0x30',
  title: '0x30 Display lamp intensity',
  managed: true,
  f(level) { return toDatagram(encodeLampIntensity(level)) }
})

module.exports.LEVEL_CODES = LEVEL_CODES
module.exports.encodeLampIntensity = encodeLampIntensity
