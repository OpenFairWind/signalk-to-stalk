'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const createManager = require('../waypoint-manager')

class Stream {
  constructor() { this.handlers = [] }
  onValue(handler) { this.handlers.push(handler); return () => { this.handlers = this.handlers.filter(item => item !== handler) } }
  push(value) { this.handlers.forEach(handler => handler(value)) }
}

function fixture(options = {}, overrides = {}) {
  const streams = new Map()
  const emitted = []
  const navigation = []
  const records = []
  const app = {
    streambundle: { getSelfStream(path) { if (!streams.has(path)) streams.set(path, new Stream()); return streams.get(path) } },
    error() {}, debug() {}, getPath() { return undefined }, ...overrides
  }
  const telemetry = { setNavigation(value) { navigation.push(value) }, record(value) { records.push(value) } }
  const manager = createManager(app, (datagram, sentence, metadata) => emitted.push({ datagram, sentence, metadata }), { updateIntervalMs: 60000, ...options }, telemetry)
  manager.start()
  return { streams, emitted, navigation, records, manager, push(path, value) { streams.get(path).push(value) } }
}

test('suppresses stale established navigation and fresh data recovers', () => {
  let clock = 1000
  let refresh
  const originalSetInterval = global.setInterval
  const originalClearInterval = global.clearInterval
  global.setInterval = callback => { refresh = callback; return { unref() {} } }
  global.clearInterval = () => {}
  try {
    const f = fixture({ bearingReference: 'true', updateIntervalMs: 1000, maximumAgeMs: 100, now: () => clock })
    f.push('navigation.course.calcValues.distance', 1000)
    f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
    f.push('navigation.course.calcValues.crossTrackError', 10)
    f.push('navigation.course.nextPoint', { id: 'a', name: 'WPT1' })
    assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
    clock = 3000
    refresh()
    assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
    assert.equal(f.manager.getState().lastSuppressionReason, 'navigation-stale')
    f.push('navigation.course.calcValues.distance', 900)
    f.push('navigation.course.calcValues.bearingTrue', Math.PI / 3)
    f.push('navigation.course.calcValues.crossTrackError', 9)
    assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82', '0x85'])
    assert.equal(f.manager.getState().calculationsAvailable, true)
    f.manager.stop()
  } finally {
    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
  }
})

test('does not repeat the waypoint-change announcement while calculations are unavailable', () => {
  let clock = 1000
  let refresh
  const originalSetInterval = global.setInterval
  const originalClearInterval = global.clearInterval
  global.setInterval = callback => { refresh = callback; return { unref() {} } }
  global.clearInterval = () => {}
  try {
    const f = fixture({ updateIntervalMs: 1000, now: () => clock })
    f.push('navigation.course.nextPoint', { id: 'a', name: 'WPT1' })
    clock = 2000
    refresh()
    assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
    f.manager.stop()
  } finally {
    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
  }
})

test('target-only selection immediately announces 0x82', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { name: 'WPT1', position: { latitude: 1, longitude: 2 } })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  assert.equal(f.manager.getState().active, true)
  assert.equal(f.manager.getState().announcedName, 'WPT1')
  assert.equal(f.manager.getState().calculationsAvailable, false)
  f.manager.stop()
})

test('navigation precedes waypoint announcement when calculations already exist', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 5.5 * 1852)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 100)
  f.push('navigation.course.nextPoint', { name: 'WPT1', position: { latitude: 1, longitude: 2 } })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
  f.manager.stop()
})

test('magnetic mode falls back to a flagged true bearing when variation is unavailable', () => {
  const f = fixture({ bearingReference: 'magnetic' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  f.push('navigation.course.nextPoint', { id: 'a', name: 'WPT1' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
  assert.equal(f.emitted[0].metadata.values.bearingTrue, true)
  f.manager.stop()
})

test('rate limits calculation update bursts on the SeaTalk bus', () => {
  let clock = 1000
  const f = fixture({ bearingReference: 'true', updateIntervalMs: 1000, now: () => clock })
  f.push('navigation.course.nextPoint', { id: 'a' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  f.push('navigation.course.calcValues.distance', 999)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 3)
  f.push('navigation.course.calcValues.crossTrackError', 9)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82'])
  clock = 2000
  f.push('navigation.course.calcValues.crossTrackError', 8)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82', '0x85'])
  f.manager.stop()
})

test('suppresses out-of-range guidance instead of passing an alarm-like frame to SeaTalk', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 100000)
  f.push('navigation.course.nextPoint', { id: 'a' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  assert.equal(f.manager.getState().lastSuppressionReason, 'cross-track-error-out-of-range')
  f.manager.stop()
})

test('complete calculations arriving after the target emit 0x85 followed by 0x82', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  f.push('navigation.course.calcValues.distance', 900)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82'])
  f.manager.stop()
})

test('delayed navigation emits one synchronization 0x82 and refreshes only 0x85', () => {
  let clock = 1000
  const f = fixture({ bearingReference: 'true', updateIntervalMs: 1000, maximumAgeMs: 5000, now: () => clock })
  f.push('navigation.course.nextPoint', { id: 'a', name: 'WPT1' })
  f.push('navigation.course.calcValues.distance', 900)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  clock = 2000
  f.push('navigation.course.calcValues.distance', 800)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82', '0x85'])
  f.manager.stop()
})

test('suppresses mixed-generation snapshots and accepts calculations within the skew window', () => {
  let clock = 1000
  const f = fixture({ bearingReference: 'true', updateIntervalMs: 100, maximumAgeMs: 5000, calculationSkewMs: 100, now: () => clock })
  f.push('navigation.course.nextPoint', { id: 'a' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  clock = 1500
  f.push('navigation.course.calcValues.distance', 900)
  assert.equal(f.manager.getState().lastSuppressionReason, 'navigation-incoherent')
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82'])
  clock = 1540
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 3)
  clock = 1580
  f.push('navigation.course.calcValues.crossTrackError', 9)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82', '0x85'])
  f.manager.stop()
})

test('canonical null calculation fields use legacy fallbacks', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', null)
  f.push('navigation.courseGreatCircle.nextPoint.distance', 1200)
  f.push('navigation.course.calcValues.bearingTrue', null)
  f.push('navigation.courseRhumbline.nextPoint.bearingToDestinationTrue', Math.PI / 3)
  f.push('navigation.course.calcValues.crossTrackError', null)
  f.push('navigation.courseGreatCircle.crossTrackError', 12)
  f.push('navigation.course.nextPoint', { id: 'a' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
  assert.deepEqual(f.emitted[0].metadata.values, { distance: 1200, crossTrackError: 12, bearing: Math.PI / 3, bearingTrue: true })
  f.manager.stop()
})

test('same target does not repeat 0x82', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  f.manager.stop()
})

test('same identity with an improved name emits one replacement 0x82', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha', name: 'Harbor' })
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha', name: 'Harbor' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x82'])
  assert.equal(f.manager.getState().announcedName, 'Harbor')
  f.manager.stop()
})

test('same identity does not downgrade a meaningful name to an href fallback', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha', name: 'Harbor' })
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  assert.equal(f.manager.getState().announcedName, 'Harbor')
  f.manager.stop()
})

test('target changes are announced without calculations', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { id: 'a', name: 'Same' })
  f.push('navigation.course.nextPoint', { id: 'b', name: 'Same' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x82'])
  f.manager.stop()
})

test('does not pair a replacement target with cached calculations for the previous target', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  f.push('navigation.course.nextPoint', { id: 'a', name: 'ONE' })
  f.push('navigation.course.nextPoint', { id: 'b', name: 'TWO' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82', '0x82'])
  assert.equal(f.manager.getState().calculationsAvailable, false)
  f.push('navigation.course.calcValues.distance', 900)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 3)
  f.push('navigation.course.calcValues.crossTrackError', 9)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82', '0x82', '0x85', '0x82'])
  f.manager.stop()
})

test('clear after target-only selection emits no malformed invalid 0x85', () => {
  const f = fixture()
  f.push('navigation.course.nextPoint', { id: 'a' })
  f.push('navigation.course.nextPoint', null)
  f.push('navigation.course.nextPoint', undefined)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  assert.equal(f.manager.getState().active, false)
  f.manager.stop()
})

test('clear option controls the optional fallback waypoint name', () => {
  for (const [options, expected] of [
    [{}, ['0x82']],
    [{ sendWaypointNameOnClear: true }, ['0x82', '0x82']]
  ]) {
    const f = fixture(options)
    f.push('navigation.course.nextPoint', { id: 'a' })
    f.push('navigation.course.nextPoint', null)
    assert.deepEqual(f.emitted.map(item => item.datagram), expected)
    f.manager.stop()
  }
})

test('stale calculations suppress only 0x85 and fresh data recovers', () => {
  let clock = 1000
  const f = fixture({ bearingReference: 'true', maximumAgeMs: 100, now: () => clock })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  clock = 1200
  f.push('navigation.course.nextPoint', { id: 'a' })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82'])
  assert.equal(f.manager.getState().lastSuppressionReason, 'navigation-stale')
  f.push('navigation.course.calcValues.distance', 900)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 3)
  f.push('navigation.course.calcValues.crossTrackError', 9)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x85', '0x82'])
  f.manager.stop()
})

test('canonical target clear is authoritative over a legacy target', () => {
  const f = fixture()
  f.push('navigation.courseGreatCircle.nextPoint', { id: 'legacy' })
  f.push('navigation.course.nextPoint', { id: 'canonical' })
  f.push('navigation.course.nextPoint', null)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x82', '0x82'])
  assert.equal(f.manager.getState().active, false)
  f.manager.stop()
})

test('target identity uses stable fields in priority order', () => {
  const identity = createManager.targetIdentityOf
  assert.equal(identity({ href: ' /wp/a ', ID: 'id', position: { latitude: 1, longitude: 2 }, name: 'name' }), 'href:/wp/a')
  assert.equal(identity({ ID: 42, position: { latitude: 1, longitude: 2 } }), 'id:42')
  assert.equal(identity({ id: 'x', name: 'name' }), 'id:x')
  assert.equal(identity({ position: { latitude: 1, longitude: 2 } }), 'position:1.0000000,2.0000000')
  assert.equal(identity({ name: ' Name ' }), 'name:Name')
  assert.equal(identity({ position: { latitude: NaN, longitude: 2 } }), undefined)
  assert.equal(identity(null), undefined)
})

test('waypoint names resolve deterministically and tolerate lookup errors', () => {
  const resolve = createManager.resolveWaypointName
  const quiet = { debug() {}, getPath() { return undefined } }
  assert.equal(resolve({ name: 'Direct', ID: 'id' }, null, quiet, 'WP'), 'Direct')
  assert.equal(resolve({ ID: 'ID1' }, null, quiet, 'WP'), 'ID1')
  assert.equal(resolve({ href: '/resources/waypoints/a' }, null, { debug() {}, getPath() { return { name: 'Resource' } } }, 'WP'), 'Resource')
  assert.equal(resolve({}, { pointIndex: 0, waypoints: [{ name: 'Route' }] }, quiet, 'WP'), 'Route')
  assert.equal(resolve({ href: '/resources/waypoints/alpha' }, null, quiet, 'WP'), 'alpha')
  assert.equal(resolve({}, null, quiet, 'WP'), 'WP')
  assert.equal(resolve({ href: '/resources/waypoints/alpha' }, null, { debug() {}, getPath() { throw new Error('bad') } }, 'WP'), 'alpha')
})

test('telemetry records selection, announcement, suppression, navigation and clear', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.nextPoint', { id: 'a' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 10)
  f.push('navigation.course.nextPoint', null)
  assert.equal(f.records.some(record => record.action === 'navigation-emitted'), true)
  assert.equal(f.records.at(-1).action, 'target-cleared')
  assert.equal(f.navigation.some(state => state.announcedIdentity === 'id:a'), true)
  f.manager.stop()
})

test('stop unsubscribes and prevents later output', () => {
  const f = fixture()
  assert.equal(f.streams.get('navigation.course.nextPoint').handlers.length, 1)
  f.manager.stop()
  assert.equal(f.streams.get('navigation.course.nextPoint').handlers.length, 0)
  f.push('navigation.course.nextPoint', { id: 'a' })
  assert.deepEqual(f.emitted, [])
})
