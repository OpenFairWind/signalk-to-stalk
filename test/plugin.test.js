'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

function baconStub() {
  return {
    once(value) { return { value } },
    combineWith(fn) {
      const chain = {
        filter() { return chain },
        changes() { return chain },
        debounceImmediate() { return chain },
        throttle() { return chain },
        onValue(handler) {
          chain.handler = handler
          return () => { chain.unsubscribed = true }
        }
      }
      chain.fn = fn
      return chain
    }
  }
}

function loadPluginFactory() {
  const original = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === 'baconjs') return baconStub()
    return original.call(this, request, parent, isMain)
  }
  delete require.cache[require.resolve('../index')]
  const factory = require('../index')
  Module._load = original
  return factory
}

test('plugin schema includes all datagrams and throttle properties', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  assert.equal(plugin.id, 'signalk-to-stalk')
  for (const key of ['0x50', '0x51', '0x52', '0x53', '0x54', '0x56', '0x57', '0x99']) {
    assert.ok(plugin.schema.properties[key])
    assert.ok(plugin.schema.properties[`${key}_throttle`])
  }
  assert.ok(plugin.schema.properties.instrumentUnits)
  assert.ok(plugin.schema.properties.instrumentLights)
})

test('start is restart-safe and stop clears unsubscribe callbacks', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  plugin.start({ '0x50': true })
  assert.equal(plugin.unsubscribes.length, 1)
  plugin.start({ '0x51': true })
  assert.equal(plugin.unsubscribes.length, 1)
  plugin.stop()
  assert.equal(plugin.unsubscribes.length, 0)
  assert.equal(app.status.at(-1), 'Stopped')
})

test('invalid restart configuration leaves the running instance intact', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  plugin.start({ '0x50': true })
  assert.throws(() => plugin.start({ '0x51': 'yes' }), /0x51 must be a boolean/)
  assert.equal(plugin.unsubscribes.length, 1)
  assert.equal(plugin.telemetry.snapshot().running, true)
  assert.match(app.status.at(-1), /Running/)
  plugin.stop()
})

test('startup failure cleans up subscriptions created earlier in the attempt', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  const originalSubscribe = plugin.datagrams['0x51'].keys
  plugin.datagrams['0x51'].keys = ['failing.path']
  app.streambundle.getSelfStream = path => {
    if (path === 'failing.path') throw new Error('subscription failed')
    return { merge() { return this } }
  }
  assert.throws(() => plugin.start({ '0x50': true, '0x51': true }), /subscription failed/)
  assert.equal(plugin.unsubscribes.length, 0)
  assert.equal(plugin.telemetry.snapshot().running, false)
  plugin.datagrams['0x51'].keys = originalSubscribe
})

test('stop closes telemetry stream clients', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  let closed = false
  plugin.telemetry.attachSse({ on() {} }, { writeHead() {}, write() {}, end() { closed = true } })
  plugin.stop()
  assert.equal(closed, true)
})


test('registerWithRouter exposes read-only monitor APIs', () => {
  const app = mockApp()
  const plugin = loadPluginFactory()(app)
  const routes = {}
  plugin.registerWithRouter({ get(path, handler) { routes[path] = handler } })
  assert.ok(routes['/api/status'])
  assert.ok(routes['/api/recent'])
  assert.ok(routes['/api/stream'])
  let body
  routes['/api/status']({}, { json(value) { body = value } })
  assert.equal(body.outputEvent, 'stalkout')
})

function mockApp() {
  return {
    status: [],
    emitted: [],
    streambundle: {
      getSelfStream() { return { merge() { return this } } }
    },
    emit(...args) { this.emitted.push(args) },
    debug() {},
    error() {},
    setPluginStatus(value) { this.status.push(value) },
    setPluginError() {}
  }
}
