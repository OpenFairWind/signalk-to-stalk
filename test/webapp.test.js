'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8')

test('WebApp exposes all implemented feature groups and runtime diagnostics', () => {
  for (const text of ['Waypoint guidance', 'Display units', 'Display lighting', 'Configured features', 'Datagram counters', 'Suppressed', 'Runtime', 'Live activity', 'Speed calibration advisor', 'Suggested factor', 'Calibration guidance', 'Live connection']) {
    assert.match(html + js, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
  for (const field of ['configuration', 'perDatagram', 'bearingReference', 'maximumAgeMs', 'signalKPath', 'periodicRefreshSeconds', 'calibration', 'suggestedCalibrationFactor', 'minimumSpeedMps', 'maximumRelativeSpread']) {
    assert.match(js, new RegExp(field))
  }
})

test('WebApp remains read-only', () => {
  assert.doesNotMatch(js, /fetch\([^)]*,\s*\{[^}]*method\s*:\s*['"](?:POST|PUT|DELETE|PATCH)/i)
  assert.doesNotMatch(html, /commanded heading|send arbitrary/i)
  assert.match(js, /eventFilter/)
  assert.match(js, /Pause/)
})
