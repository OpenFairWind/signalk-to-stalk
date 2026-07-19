'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

function load() {
  const original = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'baconjs') return { combineWith() { return { filter(){return this}, changes(){return this}, debounceImmediate(){return this}, onValue(){ return () => {} } } } }
    return original.call(this, request, parent, isMain)
  }
  delete require.cache[require.resolve('../calibration-manager')]
  const value = require('../calibration-manager')
  Module._load = original
  return value
}

test('median supports odd and even sample sets', () => {
  const { median } = load()
  assert.equal(median([1, 2, 3]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
})

test('speed advisor calculates multiplier and suggested ST60 factor', () => {
  const create = load()
  let calibration
  const telemetry = { record(){}, setCalibration(value){ calibration = value } }
  const manager = create({}, { currentCalibrationFactor: 0.95, minimumSamples: 10, windowSize: 20 }, telemetry)
  for (let i = 0; i < 10; i++) manager.addSample({ stw: 4, sog: 4.4 })
  assert.equal(calibration.stable, true)
  assert.ok(Math.abs(calibration.multiplier - 1.1) < 1e-9)
  assert.ok(Math.abs(calibration.suggestedCalibrationFactor - 1.045) < 1e-9)
})
