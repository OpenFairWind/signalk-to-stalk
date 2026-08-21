'use strict'
const { assertFinite, toDatagram } = require('../stalk')

const MPS_TO_KNOTS = 1.9438444924406048

module.exports = () => ({
  datagram: '0x11',
  title: '0x11 Apparent wind speed',
  keys: ['environment.wind.speedApparent'],
  f(speedMps) {
    if (speedMps == null) return undefined
    assertFinite(speedMps, 'speedApparent')
    if (speedMps < 0) throw new RangeError('speedApparent must not be negative')

    const tenthsOfKnot = Math.round(speedMps * MPS_TO_KNOTS * 10)
    if (tenthsOfKnot > 1279) throw new RangeError('speedApparent exceeds the SeaTalk field capacity')
    const wholeKnots = Math.floor(tenthsOfKnot / 10)
    const tenths = tenthsOfKnot % 10
    return toDatagram([0x11, 0x01, wholeKnots, tenths])
  }
})
