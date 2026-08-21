'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { distanceAndBearing, crossTrackError, calculateNavigation } = require('../navigation-geometry')

test('great-circle geometry handles cardinal directions, coincidence, and dateline crossing', () => {
  assert.deepEqual(distanceAndBearing({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), { distance: 0, bearingTrue: 0 })
  assert.ok(Math.abs(distanceAndBearing({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }).bearingTrue) < 1e-12)
  assert.ok(Math.abs(distanceAndBearing({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }).bearingTrue - Math.PI / 2) < 1e-12)
  const acrossDateline = distanceAndBearing({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 })
  assert.ok(acrossDateline.distance > 22000 && acrossDateline.distance < 22300)
})

test('cross-track sign follows Signal K convention', () => {
  const start = { latitude: 0, longitude: 0 }
  const destination = { latitude: 0, longitude: 2 }
  assert.ok(crossTrackError(start, destination, { latitude: 0.1, longitude: 1 }) < 0)
  assert.ok(crossTrackError(start, destination, { latitude: -0.1, longitude: 1 }) > 0)
  assert.equal(calculateNavigation(start, destination).crossTrackError, 0)
})

test('geometry rejects invalid coordinates', () => {
  assert.throws(() => distanceAndBearing({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 }), /out of range/)
  assert.throws(() => distanceAndBearing({ latitude: 0, longitude: NaN }, { latitude: 0, longitude: 0 }), /finite/)
})
