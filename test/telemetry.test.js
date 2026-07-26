'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const createTelemetry = require('../telemetry')

test('telemetry bounds history and counts datagrams', () => {
  const t = createTelemetry({ capacity: 2 })
  t.record({ type: 'emitted', datagram: '0x50', sentence: '$STALK,50', bytes: ['50'] })
  t.record({ type: 'emitted', datagram: '0x50', sentence: '$STALK,50,02', bytes: ['50', '02'] })
  t.record({ type: 'error', message: 'bad' })
  assert.equal(t.recent(10).length, 2)
  assert.deepEqual(t.snapshot().totals, { emitted: 2, suppressed: 0, errors: 1 })
  assert.equal(t.snapshot().perDatagram['0x50'], 2)
  assert.deepEqual(t.snapshot().lastDatagrams['0x50'].bytes, ['50', '02'])
  assert.equal(t.snapshot().lastDatagrams['0x50'].sentence, '$STALK,50,02')
})

test('telemetry emits snapshot and live records over SSE', () => {
  const t = createTelemetry()
  const writes = []
  const handlers = {}
  const req = { on(name, fn) { handlers[name] = fn } }
  const res = { writeHead(code, headers) { this.code=code; this.headers=headers }, write(v) { writes.push(v) } }
  t.attachSse(req, res)
  t.record({ type: 'navigation', action: 'target-selected' })
  assert.equal(res.code, 200)
  assert.match(writes[0], /"type":"snapshot"/)
  assert.match(writes[1], /target-selected/)
  handlers.close()
})


test('telemetry snapshot includes a detached configuration summary', () => {
  const t = createTelemetry()
  const configuration = { direct: [{ datagram: '0x50', enabled: true }] }
  t.setConfiguration(configuration)
  configuration.direct[0].enabled = false
  assert.equal(t.snapshot().configuration.direct[0].enabled, true)
})
