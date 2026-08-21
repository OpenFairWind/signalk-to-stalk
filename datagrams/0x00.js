'use strict'
const { assertFinite, toDatagram } = require('../stalk')

module.exports = () => ({
  datagram: '0x00',
  title: '0x00 Depth below transducer',
  keys: ['environment.depth.belowTransducer'],
  f(depthMetres) {
    if (depthMetres == null) return undefined
    assertFinite(depthMetres, 'depthBelowTransducer')
    if (depthMetres < 0) throw new RangeError('depthBelowTransducer must not be negative')
    const tenthsFeet = Math.round(depthMetres / 0.3048 * 10)
    if (tenthsFeet > 0xffff) throw new RangeError('depthBelowTransducer exceeds the SeaTalk field capacity')
    // Alarm, unit, and sensor-failure flags are deliberately clear: Signal K
    // measurement values do not carry authoritative SeaTalk alarm state.
    return toDatagram([0x00, 0x02, 0x00, tenthsFeet & 0xff, tenthsFeet >> 8])
  }
})
