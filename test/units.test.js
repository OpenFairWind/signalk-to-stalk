'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { encodeUnits } = require('../datagrams/0x24')
const createUnitsManager = require('../units-manager')
const { resolveUnitSystem, speedToSystem, distanceToSystem } = require('../units-manager')

test('0x24 encodes nautical, statute, and metric systems', () => {
  assert.deepEqual(encodeUnits('nautical'), [0x24, 0x02, 0x00, 0x00, 0x00])
  assert.deepEqual(encodeUnits('statute'), [0x24, 0x02, 0x00, 0x00, 0x06])
  assert.deepEqual(encodeUnits('metric'), [0x24, 0x02, 0x00, 0x00, 0x86])
  assert.throws(() => encodeUnits('invalid'), /nautical, statute, or metric/)
})

test('unit aliases map to SeaTalk systems', () => {
  assert.equal(speedToSystem('kn'), 'nautical')
  assert.equal(speedToSystem('mph'), 'statute')
  assert.equal(speedToSystem('km/h'), 'metric')
  assert.equal(distanceToSystem('nm'), 'nautical')
  assert.equal(distanceToSystem('mi'), 'statute')
  assert.equal(distanceToSystem('km'), 'metric')
})

test('resolver uses active unit preferences', () => {
  const app = { getUnitPreferences: () => ({ speed: { targetUnit: 'km/h' }, distance: { targetUnit: 'km' } }) }
  assert.equal(resolveUnitSystem(app, { speedAndDistance: 'auto' }), 'metric')
})

test('resolver falls back to displayUnits metadata', () => {
  const metadata = {
    'navigation.speedOverGround': { displayUnits: { targetUnit: 'kn' } },
    'navigation.log': { displayUnits: 'nm' }
  }
  const app = { getMetadata: path => metadata[path] }
  assert.equal(resolveUnitSystem(app, { speedAndDistance: 'auto' }), 'nautical')
})

test('resolver suppresses incoherent speed and distance preferences', () => {
  const errors = []
  const app = {
    getUnitPreferences: () => ({ speed: 'kn', distance: 'km' }),
    error: message => errors.push(message)
  }
  assert.equal(resolveUnitSystem(app, { speedAndDistance: 'auto' }), undefined)
  assert.match(errors[0], /cannot be represented coherently/)
})

test('manager emits once, suppresses duplicates, and emits on change', () => {
  let preference = { speed: 'kn', distance: 'nm' }
  const emitted = []
  const app = {
    getUnitPreferences: () => preference,
    debug() {}, error() {}, setPluginError() {}
  }
  const encoder = { f: system => `sentence:${system}` }
  const manager = createUnitsManager(app, (id, sentence) => emitted.push([id, sentence]), encoder, {
    sendOnStartup: false,
    resendOnChange: false
  })
  manager.evaluate(true)
  manager.evaluate(false)
  preference = { speed: 'km/h', distance: 'km' }
  manager.evaluate(false)
  assert.deepEqual(emitted, [
    ['0x24', 'sentence:nautical'],
    ['0x24', 'sentence:metric']
  ])
  manager.stop()
})

test('fixed unit source does not consult Signal K preferences', () => {
  const app = {
    getUnitPreferences() { return { speed: 'km/h', distance: 'km' } }
  }
  assert.equal(resolveUnitSystem(app, { source: 'configuration', speedAndDistance: 'statute' }), 'statute')
  assert.equal(resolveUnitSystem(app, { source: 'configuration', speedAndDistance: 'auto' }), 'nautical')
})
