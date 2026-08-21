'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'manifest.json'), 'utf8'))
const packageJson = require('../package.json')

test('WebApp exposes all implemented feature groups and runtime diagnostics', () => {
  for (const text of ['Waypoint guidance', 'Display units', 'Display lighting', 'Configured features', 'Datagram indicators', 'Complete live coverage', 'Datagram counters', 'Suppressed', 'Runtime', 'Live activity', 'Speed calibration advisor', 'Suggested factor', 'Calibration guidance', 'Suggested ST60 heading alignment', 'Heading guidance', 'Live connection']) {
    assert.match(html + js, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
  for (const field of ['configuration', 'perDatagram', 'lastDatagrams', 'renderIndicators', 'bearingReference', 'maximumAgeMs', 'signalKPath', 'periodicRefreshSeconds', 'calibration', 'suggestedCalibrationFactor', 'minimumSpeedMps', 'maximumRelativeSpread', 'headingCalibration', 'suggestedHeadingOffsetDegrees']) {
    assert.match(js, new RegExp(field))
  }
})

test('WebApp remains read-only', () => {
  assert.doesNotMatch(js, /fetch\([^)]*,\s*\{[^}]*method\s*:\s*['"](?:POST|PUT|DELETE|PATCH)/i)
  assert.doesNotMatch(html, /commanded heading|send arbitrary/i)
  assert.match(js, /eventFilter/)
  assert.match(js, /Pause/)
})

test('WebApp handles degraded API and stream states without losing read-only behavior', () => {
  assert.match(js, /safeJson/)
  assert.match(js, /Stream data error/)
  assert.match(js, /Stream reconnecting/)
  assert.match(js, /apiGet/)
  assert.match(html, /aria-label="Filter live activity events"/)
  assert.match(html, /scope="col"/)
})

test('WebApp reads telemetry from the Signal K plugin API mount', () => {
  assert.match(js, /['"]\/plugins\/signalk-to-stalk\/api\/['"]/)
  assert.match(js, /credentials:\s*['"]include['"]/)
  assert.match(js, /withCredentials:\s*true/)
  assert.doesNotMatch(js, /(?:fetch|EventSource)\(['"]api\//)
})

test('WebApp dashboard icon uses a packaged public-relative raster asset', () => {
  assert.equal(packageJson.signalk.appIcon, './icon-72x72.png')
  assert.equal(path.dirname(packageJson.signalk.appIcon), '.')
  const icon = fs.readFileSync(path.join(__dirname, '..', 'public', packageJson.signalk.appIcon))
  assert.deepEqual(icon.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(icon.readUInt32BE(16), 72)
  assert.equal(icon.readUInt32BE(20), 72)
  assert.ok(manifest.icons.some(icon => icon.src === 'icon-72x72.png' && icon.type === 'image/png' && icon.sizes === '72x72'))
})
