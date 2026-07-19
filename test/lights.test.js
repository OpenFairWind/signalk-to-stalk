'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { encodeLampIntensity } = require('../datagrams/0x30')
const createLightsManager = require('../lights-manager')
const { brightnessToLevel } = require('../lights-manager')

test('0x30 encodes SeaTalk lamp levels L0 through L3', () => {
  assert.deepEqual(encodeLampIntensity(0), [0x30, 0x00, 0x00])
  assert.deepEqual(encodeLampIntensity(1), [0x30, 0x00, 0x04])
  assert.deepEqual(encodeLampIntensity(2), [0x30, 0x00, 0x08])
  assert.deepEqual(encodeLampIntensity(3), [0x30, 0x00, 0x0c])
  assert.throws(() => encodeLampIntensity(4), /0 and 3/)
})

test('brightness values map to four discrete levels', () => {
  assert.equal(brightnessToLevel(0, 'ratio'), 0)
  assert.equal(brightnessToLevel(0.2, 'ratio'), 1)
  assert.equal(brightnessToLevel(0.5, 'ratio'), 2)
  assert.equal(brightnessToLevel(1, 'ratio'), 3)
  assert.equal(brightnessToLevel(25, 'percent'), 1)
  assert.equal(brightnessToLevel(75, 'percent'), 3)
  assert.equal(brightnessToLevel(2, 'level'), 2)
  assert.equal(brightnessToLevel(50, 'auto'), 2)
})

test('manager sends startup value, suppresses duplicate, and sends changes', () => {
  const emitted = []
  let handler
  const stream = {
    changes() { return this },
    debounceImmediate() { return this },
    onValue(fn) { handler = fn; return () => { handler = undefined } }
  }
  const app = {
    getSelfPath: () => 0.2,
    streambundle: { getSelfStream: () => stream },
    error() {}, setPluginError() {}
  }
  const manager = createLightsManager(app, (id, sentence, details) => emitted.push([id, sentence, details]), { f: level => `light:${level}` }, {
    valueFormat: 'ratio', minimumIntervalMs: 0
  })
  manager.start()
  handler(0.2)
  handler(0.8)
  assert.equal(emitted.length, 2)
  assert.equal(emitted[0][1], 'light:1')
  assert.equal(emitted[1][1], 'light:3')
  assert.equal(emitted[1][2].reason, 'lights-change')
  manager.stop()
})

test('configuration source supports inversion', () => {
  const emitted = []
  const manager = createLightsManager({ error() {} }, (id, sentence) => emitted.push([id, sentence]), { f: level => `light:${level}` }, {
    source: 'configuration', configuredLevel: 0, invert: true
  })
  manager.start()
  assert.deepEqual(emitted, [['0x30', 'light:3']])
})
