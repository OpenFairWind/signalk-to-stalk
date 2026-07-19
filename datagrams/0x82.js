'use strict'
const { toDatagram } = require('../stalk')

function normalizeWaypointName(value, fallback = 'WP') {
  const source = String(value == null || value === '' ? fallback : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  const safe = Array.from(source).map(character => {
    const code = character.charCodeAt(0)
    return code >= 0x30 && code <= 0x6f ? character : '_'
  }).join('')
  return (safe || 'WP').slice(-4).padEnd(4, '0')
}

function encodeWaypointName(value, fallback) {
  const name = normalizeWaypointName(value, fallback)
  const codes = Array.from(name, character => character.charCodeAt(0) - 0x30)
  const xx = (codes[0] & 0x3f) | ((codes[1] & 0x03) << 6)
  const yy = ((codes[1] >> 2) & 0x0f) | ((codes[2] & 0x0f) << 4)
  const zz = ((codes[2] >> 4) & 0x03) | ((codes[3] & 0x3f) << 2)
  return [xx, 0xff - xx, yy, 0xff - yy, zz, 0xff - zz]
}

module.exports = () => ({
  datagram: '0x82',
  title: '0x82 Target waypoint name',
  managed: true,
  f(name, fallback) {
    return toDatagram([0x82, 0x05, ...encodeWaypointName(name, fallback)])
  }
})

module.exports.encodeWaypointName = encodeWaypointName
module.exports.normalizeWaypointName = normalizeWaypointName
