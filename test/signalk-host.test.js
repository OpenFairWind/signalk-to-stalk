'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Bacon = require('baconjs')
const createPlugin = require('../index')

const settle = (milliseconds = 40) => new Promise(resolve => setTimeout(resolve, milliseconds))

function createSignalKApp() {
  const streams = new Map()
  return {
    streams,
    emitted: [],
    debugMessages: [],
    errors: [],
    pluginErrors: [],
    statuses: [],
    streambundle: {
      getSelfStream(path) {
        if (!streams.has(path)) streams.set(path, new Bacon.Bus())
        return streams.get(path)
      }
    },
    emit(event, value) { this.emitted.push({ event, value }) },
    debug(message) { this.debugMessages.push(message) },
    error(message) { this.errors.push(message) },
    setPluginError(message) { this.pluginErrors.push(message) },
    setPluginStatus(message) { this.statuses.push(message) }
  }
}

test('Signal K host contract', async t => {
  await t.test('publishes a converted value on the general and datagram-specific events', async () => {
    const app = createSignalKApp()
    const plugin = createPlugin(app)

    plugin.start({ '0x52': true })
    app.streams.get('navigation.speedOverGround').push(5.14444)
    await settle()

    assert.deepEqual(app.emitted, [
      { event: 'stalkout', value: '$STALK,52,01,64,00*45\r\n' },
      { event: 'stalkout:52', value: '$STALK,52,01,64,00*45\r\n' }
    ])
    assert.equal(app.statuses.at(-1), 'Running with 1 datagram enabled')
    assert.equal(plugin.telemetry.snapshot().totals.emitted, 1)
    assert.equal(plugin.telemetry.snapshot().perDatagram['0x52'], 1)

    plugin.stop()
  })

  await t.test('reports encoder failures without publishing malformed output', async () => {
    const app = createSignalKApp()
    const plugin = createPlugin(app)

    plugin.start({ '0x52': true })
    app.streams.get('navigation.speedOverGround').push(-1)
    await settle()

    assert.equal(app.emitted.length, 0)
    assert.match(app.errors.at(-1), /Failed to encode 0x52/)
    assert.match(app.pluginErrors.at(-1), /speedOverGround must not be negative/)
    assert.equal(plugin.telemetry.snapshot().totals.errors, 1)

    plugin.stop()
  })

  await t.test('unsubscribes from Signal K streams when stopped', async () => {
    const app = createSignalKApp()
    const plugin = createPlugin(app)

    plugin.start({ '0x52': true })
    const speed = app.streams.get('navigation.speedOverGround')
    plugin.stop()
    speed.push(5.14444)
    await settle()

    assert.equal(app.emitted.length, 0)
    assert.equal(plugin.unsubscribes.length, 0)
    assert.equal(plugin.telemetry.snapshot().running, false)
    assert.equal(app.statuses.at(-1), 'Stopped')
  })

  await t.test('rejects obsolete configuration before creating subscriptions', () => {
    const app = createSignalKApp()
    const plugin = createPlugin(app)

    assert.throws(
      () => plugin.start({ instrumentUnits: { mode: 'broadcast-compatible' } }),
      /Unsupported instrumentUnits properties: mode/
    )
    assert.equal(app.streams.size, 0)
    assert.equal(plugin.unsubscribes.length, 0)
    assert.equal(plugin.telemetry.snapshot().running, false)
  })
})
