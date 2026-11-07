'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Bacon = require('baconjs')
const createPlugin = require('../index')

const settle = () => new Promise(resolve => setTimeout(resolve, 30))

test('0x53 suppresses a null variation without reporting an error and resumes output', async t => {
  const streams = new Map()
  const emitted = []
  const errors = []
  const app = {
    streambundle: {
      getSelfStream(path) {
        if (!streams.has(path)) streams.set(path, new Bacon.Bus())
        return streams.get(path)
      }
    },
    emit(event, sentence) { emitted.push([event, sentence]) },
    debug() {},
    error(message) { errors.push(message) },
    setPluginStatus() {},
    setPluginError(message) { errors.push(message) }
  }
  const plugin = createPlugin(app)
  t.after(() => plugin.stop())
  plugin.start({ '0x53': true })

  const course = streams.get('navigation.courseOverGroundTrue')
  const variation = streams.get('navigation.magneticVariation')
  course.push(0)
  variation.push(0)
  await settle()
  assert.equal(emitted.filter(([event]) => event === 'stalkout:53').length, 1)

  variation.push(null)
  await settle()
  assert.equal(emitted.filter(([event]) => event === 'stalkout:53').length, 1)
  assert.deepEqual(errors, [])

  variation.push(10 * Math.PI / 180)
  await settle()
  assert.equal(emitted.filter(([event]) => event === 'stalkout:53').length, 2)
  assert.deepEqual(errors, [])
})
