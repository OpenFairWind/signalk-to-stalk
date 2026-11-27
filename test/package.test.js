'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { verifyPackage } = require('../scripts/verify-package')

test('package metadata, icon, changelog and syntax checks are release-consistent', () => {
  assert.deepEqual(verifyPackage().problems, [])
})

test('package verification rejects a release tag that does not match the version', () => {
  const { version, problems } = verifyPackage(undefined, { tag: 'v0.0.0' })
  assert.ok(problems.some(problem => problem.includes(`v${version}`)))
  assert.deepEqual(verifyPackage(undefined, { tag: `v${version}` }).problems, [])
})
