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
  const sentences = () => emitted.filter(([event]) => event === 'stalkout:53').map(([, sentence]) => sentence.trimEnd())

  course.push(0)
  variation.push(0)
  await settle()
  // Updates within the 20 ms coalescing window may produce a leading and a
  // trailing sentence; only the latest output is significant.
  const established = sentences().length
  assert.ok(established >= 1)
  assert.match(sentences().at(-1), /^\$STALK,53,00,00\*/)

  variation.push(null)
  await settle()
  assert.equal(sentences().length, established)
  assert.deepEqual(errors, [])

  variation.push(10 * Math.PI / 180)
  await settle()
  assert.equal(sentences().length, established + 1)
  // 0 deg true with 10 deg east variation is 350 deg magnetic.
  assert.match(sentences().at(-1), /^\$STALK,53,30,28\*/)
  assert.deepEqual(errors, [])
})
