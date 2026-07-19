'use strict'
const { assertFinite, toDatagram } = require('../stalk')
const MPS_TO_KNOTS = 1.9438444924406048
module.exports = () => ({
  datagram: '0x52',
  title: '0x52 Speed over ground',
  keys: ['navigation.speedOverGround'],
  f(speedMps) {
    if (speedMps == null) return undefined
    assertFinite(speedMps, 'speedOverGround')
    if (speedMps < 0) throw new RangeError('speedOverGround must not be negative')
    const tenthsOfKnot = Math.round(speedMps * MPS_TO_KNOTS * 10)
    if (tenthsOfKnot > 0xffff) throw new RangeError('speedOverGround exceeds the SeaTalk field capacity')
    return toDatagram([0x52, 0x01, tenthsOfKnot & 0xff, tenthsOfKnot >> 8])
  }
})
