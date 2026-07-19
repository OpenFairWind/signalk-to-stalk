'use strict'
const { parseDate, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x54',
  title: '0x54 UTC time',
  keys: ['navigation.datetime'],
  f(value) {
    if (value == null) return undefined
    const date = parseDate(value)
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const seconds = date.getUTCSeconds()
    const rs = (minutes << 2) | ((seconds >> 4) & 0x03)
    const t = seconds & 0x0f
    return toDatagram([0x54, (t << 4) | 0x01, rs, hours])
  }
})
