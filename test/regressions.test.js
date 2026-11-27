'use strict'

// Regression tests for the 2.1.1 review: latest-value delivery, unit-source
// precedence, exact change-detection controls, and 0x85 overflow handling.

const test = require('node:test')
const assert = require('node:assert/strict')
const Bacon = require('baconjs')
const createPlugin = require('../index')
const { createLatestValueGate } = require('../index')
const createUnitsManager = require('../units-manager')
const { resolveUnitSystem } = require('../units-manager')
const createLightsManager = require('../lights-manager')
const createWaypointManager = require('../waypoint-manager')

const settle = (milliseconds = 60) => new Promise(resolve => setTimeout(resolve, milliseconds))

function manualClock(start = 0) {
  const timers = new Map()
  let id = 0
  const clock = {
    time: start,
    now: () => clock.time,
    setTimeout(callback, delay) { id += 1; timers.set(id, { callback, at: clock.time + delay }); return id },
    clearTimeout(handle) { timers.delete(handle) },
    advance(milliseconds) {
      clock.time += milliseconds
      for (const [handle, timer] of [...timers]) {
        if (timer.at <= clock.time) { timers.delete(handle); timer.callback() }
      }
    },
    pending: () => timers.size
  }
  return clock
}

function signalKApp() {
  const streams = new Map()
  return {
    streams,
    emitted: [],
    errors: [],
    streambundle: {
      getSelfStream(path) {
        if (!streams.has(path)) streams.set(path, new Bacon.Bus())
        return streams.get(path)
      }
    },
    emit(event, value) { this.emitted.push({ event, value }) },
    debug() {},
    error(message) { this.errors.push(message) },
    setPluginError() {},
    setPluginStatus() {}
  }
}

test('latest-value gate delivers the leading value immediately and the latest value at the trailing edge', () => {
  const clock = manualClock(1000)
  const delivered = []
  const gate = createLatestValueGate(100, value => delivered.push(value), undefined, clock)
  gate.push('a')
  gate.push('b')
  gate.push('c')
  assert.deepEqual(delivered, ['a'])
  clock.advance(99)
  assert.deepEqual(delivered, ['a'])
  clock.advance(1)
  assert.deepEqual(delivered, ['a', 'c'])
  clock.advance(500)
  gate.push('d')
  assert.deepEqual(delivered, ['a', 'c', 'd'])
})

test('latest-value gate cancel discards obsolete pending work', () => {
  const clock = manualClock()
  const delivered = []
  const gate = createLatestValueGate(100, value => delivered.push(value), undefined, clock)
  gate.push('a')
  gate.push('b')
  assert.equal(gate.hasPending(), true)
  gate.cancel()
  assert.equal(clock.pending(), 0)
  clock.advance(1000)
  assert.deepEqual(delivered, ['a'])
})

test('latest-value gate reports delivery errors without breaking later delivery', () => {
  const clock = manualClock()
  const errors = []
  let fail = true
  const delivered = []
  const gate = createLatestValueGate(10, value => { if (fail) throw new Error('boom'); delivered.push(value) }, error => errors.push(error.message), clock)
  gate.push('a')
  fail = false
  gate.push('b')
  clock.advance(10)
  assert.deepEqual(errors, ['boom'])
  assert.deepEqual(delivered, ['b'])
})

test('direct datagrams emit the latest value after a burst of updates', async () => {
  const app = signalKApp()
  const plugin = createPlugin(app)
  plugin.start({ '0x52': true })
  const sog = app.streams.get('navigation.speedOverGround')
  sog.push(1)
  sog.push(2)
  sog.push(5.14444)
  await settle()
  const sentences = app.emitted.filter(item => item.event === 'stalkout').map(item => item.value)
  assert.equal(sentences.at(-1), '$STALK,52,01,64,00*45\r\n')
  assert.equal(sentences.length, 2)
  plugin.stop()
})

test('direct multi-path datagrams converge on values from the same delta', async () => {
  const app = signalKApp()
  const plugin = createPlugin(app)
  plugin.start({ '0x25': true })
  app.streams.get('navigation.log').push(1852)
  app.streams.get('navigation.trip.log').push(1852)
  app.streams.get('navigation.log').push(2 * 1852)
  app.streams.get('navigation.trip.log').push(2 * 1852)
  await settle()
  const last = app.emitted.filter(item => item.event === 'stalkout').at(-1).value
  // total 2.0 nm = 20 tenths; trip 2.00 nm = 200 hundredths.
  assert.match(last, /^\$STALK,25,04,14,00,C8,00,00\*/)
  plugin.stop()
})

test('stop cancels a pending trailing direct emission', async () => {
  const app = signalKApp()
  const plugin = createPlugin(app)
  plugin.start({ '0x52': true, '0x52_throttle': 30 })
  const sog = app.streams.get('navigation.speedOverGround')
  sog.push(1)
  sog.push(2)
  const before = app.emitted.length
  plugin.stop()
  await settle()
  assert.equal(app.emitted.length, before)
})

test('Signal K preference source ignores the stored fixed unit default', () => {
  const app = { getUnitPreferences: () => ({ speed: 'km/h', distance: 'km' }) }
  assert.equal(resolveUnitSystem(app, { source: 'signalKPreferences', speedAndDistance: 'nautical' }), 'metric')
  assert.equal(resolveUnitSystem(app, { source: 'configuration', speedAndDistance: 'nautical' }), 'nautical')
})

test('periodic unit refresh repeats the sent system when change detection is disabled', () => {
  let preference = { speed: 'kn', distance: 'nm' }
  let time = 0
  const emitted = []
  const app = { getUnitPreferences: () => preference, debug() {}, error() {}, setPluginError() {} }
  const manager = createUnitsManager(app, (_id, _sentence, details) => emitted.push(details), { f: system => system }, {
    sendOnStartup: true,
    resendOnChange: false,
    periodicRefreshSeconds: 10,
    now: () => time
  })
  manager.evaluate(true)
  preference = { speed: 'km/h', distance: 'km' }
  time = 10000
  manager.evaluate(false)
  assert.deepEqual(emitted.map(item => [item.reason, item.unitSystem]), [['unit-startup', 'nautical'], ['unit-refresh', 'nautical']])
  manager.stop()
})

test('unit timers use only the options that apply to the selected source', () => {
  const app = { debug() {}, error() {} }
  const encoder = { f: system => system }
  const fixed = createUnitsManager(app, () => {}, encoder, { source: 'configuration', speedAndDistance: 'metric', resendOnChange: true, pollIntervalMs: 2000 })
  assert.equal(fixed.timerIntervalMs(), 0)
  const fixedRefresh = createUnitsManager(app, () => {}, encoder, { source: 'configuration', speedAndDistance: 'metric', periodicRefreshSeconds: 30, pollIntervalMs: 2000 })
  assert.equal(fixedRefresh.timerIntervalMs(), 30000)
  const preferences = createUnitsManager(app, () => {}, encoder, { resendOnChange: true, pollIntervalMs: 2000, periodicRefreshSeconds: 60 })
  assert.equal(preferences.timerIntervalMs(), 2000)
  const none = createUnitsManager(app, () => {}, encoder, { resendOnChange: false, periodicRefreshSeconds: 0 })
  assert.equal(none.timerIntervalMs(), 0)
})

test('display lights deliver the latest rapid change from a real stream', () => {
  const bus = new Bacon.Bus()
  const emitted = []
  const app = { streambundle: { getSelfStream: () => bus }, error() {}, setPluginError() {} }
  const manager = createLightsManager(app, (_id, _sentence, details) => emitted.push(details.lightLevel), { f: level => `L${level}` }, {
    sendOnStartup: false,
    minimumIntervalMs: 0
  })
  manager.start()
  bus.push(0.2)
  bus.push(0.9)
  assert.deepEqual(emitted, [1, 3])
  manager.stop()
})

test('waypoint guidance suppresses values that round past the 0x85 fields instead of throwing', () => {
  const originalSetInterval = global.setInterval
  const originalClearInterval = global.clearInterval
  global.setInterval = () => ({ unref() {} })
  global.clearInterval = () => {}
  try {
    const streams = new Map()
    const emitted = []
    const app = {
      streambundle: {
        getSelfStream(path) {
          if (!streams.has(path)) streams.set(path, new Bacon.Bus())
          return streams.get(path)
        }
      },
      error() {}, debug() {}, getPath() { return undefined }
    }
    const manager = createWaypointManager(app, (datagram) => emitted.push(datagram), { bearingReference: 'true' })
    manager.start()
    streams.get('navigation.course.calcValues.bearingTrue').push(0)
    streams.get('navigation.course.calcValues.crossTrackError').push(0)
    streams.get('navigation.course.calcValues.distance').push(409.56 * 1852)
    assert.doesNotThrow(() => streams.get('navigation.course.nextPoint').push({ id: 'far', name: 'FAR' }))
    assert.deepEqual(emitted, [])
    assert.equal(manager.getState().lastSuppressionReason, 'distance-out-of-range')
    streams.get('navigation.course.calcValues.crossTrackError').push(-40.956 * 1852)
    streams.get('navigation.course.calcValues.distance').push(1852)
    assert.deepEqual(emitted, [])
    assert.equal(manager.getState().lastSuppressionReason, 'cross-track-error-out-of-range')
    manager.stop()
  } finally {
    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
  }
})
