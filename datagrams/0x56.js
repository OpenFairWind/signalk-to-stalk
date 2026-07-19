'use strict'
const { parseDate, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x56',
  title: '0x56 UTC date',
  keys: ['navigation.datetime'],
  f(value) {
    if (value == null) return undefined
    const date = parseDate(value)
    const year = date.getUTCFullYear() - 2000
    if (year < 0 || year > 255) throw new RangeError('date year must be between 2000 and 2255')
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    return toDatagram([0x56, (month << 4) | 0x01, day, year])
  }
})
