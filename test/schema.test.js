'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

function loadPluginFactory() {
  const original = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'baconjs') return { once() {}, combineWith() {} }
    return original.call(this, request, parent, isMain)
  }
  delete require.cache[require.resolve('../index')]
  const factory = require('../index')
  Module._load = original
  return factory
}

function appStub() {
  return {
    streambundle: { getSelfStream() { throw new Error('not used') } },
    emit() {}, debug() {}, error() {}
  }
}

test('settings schema exposes every implemented feature without non-functional controls', () => {
  const schema = loadPluginFactory()(appStub()).schema
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)

  for (const command of ['0x50', '0x51', '0x52', '0x53', '0x54', '0x56']) {
    assert.equal(schema.properties[command].type, 'boolean')
    assert.match(schema.properties[command].description, /Signal K|navigation/)
    assert.equal(schema.properties[`${command}_throttle`].type, 'integer')
  }

  const waypoint = schema.properties.navigationToWaypoint
  assert.match(waypoint.description, /does not engage or control/i)
  assert.ok(Array.isArray(schema.propertyOrder))
  assert.ok(schema.propertyOrder.includes('navigationToWaypoint'))
  assert.equal(waypoint.properties.calculationSkewMs.default, 1000)
  assert.deepEqual(waypoint.properties.bearingReference.enum, ['magnetic', 'true', 'auto'])
  assert.deepEqual(waypoint.properties.sendInvalidOnClear.enum, [false])

  const units = schema.properties.instrumentUnits.properties
  assert.deepEqual(units.source.enum, ['signalKPreferences', 'configuration'])
  assert.deepEqual(units.speedAndDistance.enum, ['nautical', 'statute', 'metric'])
  assert.equal(units.mode, undefined)
  assert.equal(units.windSpeed, undefined)
  assert.equal(units.depth, undefined)
  assert.equal(units.temperature, undefined)

  const calibration = schema.properties.calibrationAdvisor.properties
  assert.equal(calibration.currentCalibrationFactor.type, 'number')
  assert.equal(calibration.minimumSamples.minimum, 10)
  assert.equal(calibration.headingEnabled.default, true)
  assert.equal(calibration.headingMaximumSpreadDegrees.default, 5)

  const lights = schema.properties.instrumentLights.properties
  assert.deepEqual(lights.source.enum, ['signalKPath', 'configuration'])
  assert.equal(lights.configuredLevel.maximum, 3)
  assert.match(lights.signalKPath.description, /only when/i)
  assert.match(schema.properties.calibrationAdvisor.description, /slack water/i)
})


test('current schema rejects legacy and unknown configuration properties', () => {
  const factory = loadPluginFactory()
  const plugin = factory(appStub())
  assert.throws(() => factory.validateCurrentConfiguration({ instrumentUnits: { mode: 'broadcast-compatible' } }, plugin.schema), /Unsupported instrumentUnits properties/)
  assert.throws(() => factory.validateCurrentConfiguration({ oldOption: true }, plugin.schema), /Unsupported configuration properties/)
  assert.throws(() => factory.validateCurrentConfiguration({ instrumentUnits: { source: 'configuration' } }, plugin.schema), /speedAndDistance is required/)
  assert.doesNotThrow(() => factory.validateCurrentConfiguration({ instrumentUnits: { enabled: true, source: 'configuration', speedAndDistance: 'nautical' } }, plugin.schema))
  assert.throws(() => factory.validateCurrentConfiguration({ navigationToWaypoint: { sendInvalidOnClear: true } }, plugin.schema), /must be false/)
})

test('configuration summary exposes all implemented features to the WebApp', () => {
  const factory = loadPluginFactory()
  const plugin = factory(appStub())
  const summary = factory.configurationSummary({
    '0x50': true,
    '0x50_throttle': 250,
    navigationToWaypoint: { enabled: true, bearingReference: 'true' },
    instrumentUnits: { enabled: true, source: 'configuration', speedAndDistance: 'metric' },
    instrumentLights: { enabled: true, source: 'configuration', configuredLevel: 2 },
    calibrationAdvisor: { enabled: true, currentCalibrationFactor: 0.95 }
  }, plugin.datagrams)
  assert.equal(summary.direct.find(item => item.datagram === '0x50').enabled, true)
  assert.equal(summary.navigationToWaypoint.bearingReference, 'true')
  assert.equal(summary.navigationToWaypoint.calculationSkewMs, 1000)
  assert.equal(summary.instrumentUnits.speedAndDistance, 'metric')
  assert.equal(summary.instrumentLights.configuredLevel, 2)
  assert.equal(summary.calibrationAdvisor.currentCalibrationFactor, 0.95)
})
