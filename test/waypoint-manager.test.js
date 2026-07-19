'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const createManager = require('../waypoint-manager')

class Stream {
  constructor() { this.handlers = [] }
  onValue(handler) { this.handlers.push(handler); return () => { this.handlers = this.handlers.filter(item => item !== handler) } }
  push(value) { this.handlers.forEach(handler => handler(value)) }
}

function fixture(options = {}) {
  const streams = new Map()
  const emitted = []
  const app = {
    streambundle: { getSelfStream(path) { if (!streams.has(path)) streams.set(path, new Stream()); return streams.get(path) } },
    error() {}, debug() {}, getPath() { return undefined }
  }
  const manager = createManager(app, (datagram, sentence) => emitted.push({ datagram, sentence }), { updateIntervalMs: 60000, ...options })
  manager.start()
  return { streams, emitted, manager, push(path, value) { streams.get(path).push(value) } }
}

test('new target emits 0x85 before 0x82 once navigation data exists', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 5.5 * 1852)
  f.push('navigation.course.calcValues.bearingTrue', Math.PI / 4)
  f.push('navigation.course.calcValues.crossTrackError', 100)
  f.push('navigation.course.nextPoint', { name: 'WPT1', position: { latitude: 1, longitude: 2 } })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
  f.manager.stop()
})

test('navigation updates refresh 0x85 without repeating waypoint name', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', 1)
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  f.emitted.length = 0
  f.push('navigation.course.calcValues.distance', 900)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85'])
  f.manager.stop()
})

test('clearing canonical target emits one invalid 0x85 and clears state', () => {
  const f = fixture({ bearingReference: 'true' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.course.calcValues.bearingTrue', 1)
  f.push('navigation.course.nextPoint', { href: '/resources/waypoints/alpha' })
  f.emitted.length = 0
  f.push('navigation.course.nextPoint', null)
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85'])
  assert.equal(f.manager.getState().active, false)
  f.manager.stop()
})

test('magnetic bearing is derived from true bearing and variation', () => {
  const f = fixture({ bearingReference: 'magnetic' })
  f.push('navigation.course.calcValues.distance', 1000)
  f.push('navigation.magneticVariation', 0.1)
  f.push('navigation.course.calcValues.bearingTrue', 1)
  f.push('navigation.course.nextPoint', { position: { latitude: 1, longitude: 2 } })
  assert.deepEqual(f.emitted.map(item => item.datagram), ['0x85', '0x82'])
  f.manager.stop()
})
