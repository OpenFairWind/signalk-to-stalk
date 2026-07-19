'use strict'
const { encodeCoordinate, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x50',
  title: '0x50 Latitude',
  keys: ['navigation.position'],
  f(position) {
    if (!position || !Number.isFinite(position.latitude)) return undefined
    const [degrees, low, high] = encodeCoordinate(position.latitude, 90, false)
    return toDatagram([0x50, 0x02, degrees, low, high])
  }
})
