'use strict'
const { encodeCoordinate, toDatagram } = require('../stalk')
module.exports = () => ({
  datagram: '0x51',
  title: '0x51 Longitude',
  keys: ['navigation.position'],
  f(position) {
    if (!position || !Number.isFinite(position.longitude)) return undefined
    const [degrees, low, high] = encodeCoordinate(position.longitude, 180, true)
    return toDatagram([0x51, 0x02, degrees, low, high])
  }
})
