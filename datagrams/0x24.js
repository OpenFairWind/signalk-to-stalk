'use strict'
const { toDatagram } = require('../stalk')

const UNIT_CODES = Object.freeze({
  nautical: 0x00,
  statute: 0x06,
  metric: 0x86
})

function encodeUnits(system) {
  if (!Object.hasOwn(UNIT_CODES, system)) {
    throw new RangeError('unit system must be nautical, statute, or metric')
  }
  return [0x24, 0x02, 0x00, 0x00, UNIT_CODES[system]]
}

module.exports = () => ({
  datagram: '0x24',
  title: '0x24 Speed and distance display units',
  managed: true,
  f(system) { return toDatagram(encodeUnits(system)) }
})

module.exports.UNIT_CODES = UNIT_CODES
module.exports.encodeUnits = encodeUnits
