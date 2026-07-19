'use strict'
const $ = id => document.getElementById(id)
const rows = $('events')
let rowCount = 0
let paused = false
let filter = 'all'
let refreshTimer

function finite(value) { return Number.isFinite(value) }
function fmt(value, digits = 1) { return finite(value) ? Number(value).toFixed(digits) : '—' }
function enabledLabel(value) { return value ? 'Enabled' : 'Disabled' }
function time(value) { return value ? new Date(value).toLocaleString() : '—' }
function durationMs(value) { return Number.isFinite(value) ? `${value.toLocaleString()} ms` : '—' }
function durationSeconds(value) { return Number.isFinite(value) ? (value === 0 ? 'Disabled' : `${value.toLocaleString()} s`) : '—' }
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value == null ? '' : String(value); return node.innerHTML }
function commandLabel(value) { return value ? String(value).toUpperCase() : '—' }
function title(value) { return value ? String(value).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) : '—' }
function setPill(id, text, tone = '') { const node = $(id); node.textContent = text; node.className = `pill ${tone}`.trim() }
function safeJson(value) { try { return JSON.parse(value) } catch (_) { return undefined } }

function render(snapshot) {
  const config = snapshot.configuration || {}
  const navConfig = config.navigationToWaypoint || {}
  const unitConfig = config.instrumentUnits || {}
  const lightConfig = config.instrumentLights || {}
  const calConfig = config.calibrationAdvisor || {}
  const nav = snapshot.navigation || {}
  const units = snapshot.units || {}
  const lights = snapshot.lights || {}
  const calibration = snapshot.calibration || {}

  setPill('state', snapshot.running ? 'Plugin running' : 'Plugin stopped', snapshot.running ? 'ok' : 'bad')
  $('emitted').textContent = snapshot.totals?.emitted || 0
  $('suppressed').textContent = snapshot.totals?.suppressed || 0
  $('errors').textContent = snapshot.totals?.errors || 0

  const target = nav.targetIdentity?.replace(/^\w+:/, '') || '—'
  $('target').textContent = target
  $('navtarget').textContent = target
  $('navdetail').textContent = navConfig.enabled ? (nav.active ? 'Active target' : 'Waiting for target') : 'Guidance disabled'
  const navState = !navConfig.enabled ? 'Disabled' : nav.active ? 'Active target' : 'Enabled, waiting for target'
  $('navstatus').textContent = navState
  setPill('navpill', !navConfig.enabled ? 'Disabled' : nav.active ? 'Active' : 'Waiting', !navConfig.enabled ? '' : nav.active ? 'ok' : 'warn')
  $('bearing').textContent = finite(nav.bearing) ? `${fmt(nav.bearing * 180 / Math.PI)}°` : '—'
  $('bearingref').textContent = nav.bearingTrue === true ? 'True' : nav.bearingTrue === false && finite(nav.bearing) ? 'Magnetic' : title(navConfig.bearingReference)
  $('distance').textContent = finite(nav.distance) ? `${fmt(nav.distance)} m` : '—'
  $('xte').textContent = finite(nav.crossTrackError) ? `${fmt(nav.crossTrackError)} m` : '—'
  $('navrefresh').textContent = navConfig.enabled ? durationMs(navConfig.updateIntervalMs) : '—'
  $('navmaxage').textContent = navConfig.enabled ? durationMs(navConfig.maximumAgeMs) : '—'
  $('needle').style.transform = `rotate(${finite(nav.bearing) ? nav.bearing * 180 / Math.PI : 0}deg)`
  $('compass').classList.toggle('inactive', !nav.active)

  $('units').textContent = units.system ? title(units.system) : (unitConfig.enabled ? 'Waiting' : '—')
  $('unitsdetail').textContent = unitConfig.enabled
    ? `${unitConfig.source === 'configuration' ? `Fixed ${title(unitConfig.speedAndDistance)}` : 'Signal K preferences'}${units.lastSentAt ? ` · sent ${new Date(units.lastSentAt).toLocaleTimeString()}` : ''}`
    : 'Synchronization disabled'

  $('lights').textContent = Number.isInteger(lights.level) ? `L${lights.level}` : (lightConfig.enabled ? 'Waiting' : '—')
  $('lightsdetail').textContent = lightConfig.enabled
    ? `${lightConfig.source === 'configuration' ? `Fixed L${lightConfig.configuredLevel}` : lightConfig.signalKPath}${lights.lastSentAt ? ` · sent ${new Date(lights.lastSentAt).toLocaleTimeString()}` : ''}`
    : 'Synchronization disabled'

  const calTone = !calConfig.enabled ? '' : calibration.stable ? 'ok' : 'warn'
  const calState = !calConfig.enabled ? 'Disabled' : calibration.stable ? 'Suggestion ready' : calibration.sampleCount ? 'Collecting' : 'Waiting for samples'
  setPill('calstate', calState, calTone)
  $('calmeasuredpath').textContent = calConfig.enabled ? calConfig.measuredPath : '—'
  $('calreferencepath').textContent = calConfig.enabled ? calConfig.referencePath : '—'
  $('calcurrent').textContent = finite(calibration.currentCalibrationFactor) ? fmt(calibration.currentCalibrationFactor, 3) : '—'
  $('calmultiplier').textContent = finite(calibration.multiplier) ? `× ${fmt(calibration.multiplier, 3)}` : '—'
  $('calsuggested').textContent = finite(calibration.suggestedCalibrationFactor) ? fmt(calibration.suggestedCalibrationFactor, 3) : '—'
  $('calspeeds').textContent = finite(calibration.medianMeasuredMps) && finite(calibration.medianReferenceMps) ? `${fmt(calibration.medianMeasuredMps * 1.943844, 2)} / ${fmt(calibration.medianReferenceMps * 1.943844, 2)} kn` : '—'
  $('calsamples').textContent = calConfig.enabled ? `${calibration.sampleCount || 0} of ${calibration.minimumSamples || calConfig.minimumSamples || 0} required · window ${calConfig.windowSize || '—'}` : '—'
  $('calstability').textContent = finite(calibration.relativeSpread) ? `${fmt(calibration.relativeSpread * 100, 1)}% / ${fmt((calConfig.maximumRelativeSpread || 0) * 100, 1)}%` : '—'
  $('calminspeed').textContent = calConfig.enabled ? `${fmt(calConfig.minimumSpeedMps, 2)} m/s · ${fmt(calConfig.minimumSpeedMps * 1.943844, 2)} kn` : '—'
  $('caladvisory').textContent = calibration.advisory || 'Enable the advisor to collect observations.'

  renderFeatures(config)
  renderCounters(snapshot.perDatagram || {})
  $('statusText').textContent = snapshot.status || '—'
  $('outputEvent').textContent = snapshot.outputEvent || 'stalkout'
  $('startedAt').textContent = time(snapshot.startedAt)
  $('history').textContent = `${snapshot.recentCount || 0} of ${snapshot.capacity || 0} records`
  $('lastUpdate').textContent = time(snapshot.now)
}

function renderFeatures(config) {
  const direct = Array.isArray(config.direct) ? config.direct : []
  const managed = [
    feature('0x82 / 0x85', 'Waypoint guidance', config.navigationToWaypoint?.enabled, config.navigationToWaypoint?.enabled ? `${title(config.navigationToWaypoint.bearingReference)} bearing · ${durationMs(config.navigationToWaypoint.updateIntervalMs)} refresh · ${durationMs(config.navigationToWaypoint.maximumAgeMs)} max age` : 'Passive target guidance'),
    feature('0x24', 'Display units', config.instrumentUnits?.enabled, config.instrumentUnits?.enabled ? (config.instrumentUnits.source === 'configuration' ? `Fixed ${title(config.instrumentUnits.speedAndDistance)} · startup ${enabledLabel(config.instrumentUnits.sendOnStartup)}` : `Signal K preferences · poll ${durationMs(config.instrumentUnits.pollIntervalMs)} · refresh ${durationSeconds(config.instrumentUnits.periodicRefreshSeconds)}`) : 'Network-wide speed and distance units'),
    feature('0x30', 'Display lighting', config.instrumentLights?.enabled, config.instrumentLights?.enabled ? (config.instrumentLights.source === 'configuration' ? `Fixed L${config.instrumentLights.configuredLevel} · startup ${enabledLabel(config.instrumentLights.sendOnStartup)}` : `${config.instrumentLights.signalKPath} · ${title(config.instrumentLights.valueFormat)} · min ${durationMs(config.instrumentLights.minimumIntervalMs)}`) : 'Network-wide L0–L3 illumination'),
    feature('CAL', 'Speed calibration advisor', config.calibrationAdvisor?.enabled, config.calibrationAdvisor?.enabled ? `${config.calibrationAdvisor.measuredPath} vs ${config.calibrationAdvisor.referencePath} · ${config.calibrationAdvisor.minimumSamples} samples` : 'Read-only ST60 speed-factor suggestion')
  ]
  const all = direct.map(item => feature(item.datagram, item.title, item.enabled, `${durationMs(item.minimumIntervalMs || 0)} minimum interval`)).concat(managed)
  $('features').innerHTML = all.map(item => `<article class="feature ${item.enabled ? 'enabled' : 'disabled'}"><div class="feature-head"><div class="feature-title"><strong>${escapeHtml(item.command)}</strong><span>${escapeHtml(item.name)}</span></div><b class="feature-state">${enabledLabel(item.enabled)}</b></div><small>${escapeHtml(item.detail || '')}</small></article>`).join('')
}
function feature(command, name, enabled, detail) { return { command, name, enabled: Boolean(enabled), detail } }

function renderCounters(counters) {
  const entries = Object.entries(counters).sort(([a], [b]) => a.localeCompare(b))
  $('counters').innerHTML = entries.length ? entries.map(([command, count]) => `<div><strong>${escapeHtml(commandLabel(command))}</strong><span>${count}</span></div>`).join('') : '<p class="empty">No datagrams emitted yet.</p>'
}

function add(event) {
  if (!event || typeof event !== 'object') return
  if (paused || !['emitted', 'error', 'navigation', 'suppressed', 'lifecycle'].includes(event.type)) return
  const details = event.values || compact({ unitSystem: event.unitSystem, waypointName: event.waypointName, lightLevel: event.lightLevel, sourcePath: event.sourcePath, sourceValue: event.sourceValue, level: event.level, active: event.active })
  const row = document.createElement('tr')
  row.className = event.type
  row.dataset.type = event.type
  row.hidden = filter !== 'all' && filter !== event.type
  row.innerHTML = `<td>${new Date(event.time).toLocaleTimeString()}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(commandLabel(event.datagram))}</td><td>${escapeHtml(event.reason || event.action || '')}</td><td>${escapeHtml(Object.keys(details).length ? JSON.stringify(details) : '')}</td><td>${escapeHtml(event.sentence || event.message || '')}</td>`
  rows.prepend(row)
  if (++rowCount > 300) { rows.lastElementChild?.remove(); rowCount-- }
}
function compact(object) { return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) }
function applyFilter() { for (const row of rows.children) row.hidden = filter !== 'all' && row.dataset.type !== filter }

async function refresh() {
  const response = await apiGet('api/status')
  render(response)
  setPill('connectionState', 'Live connection', 'ok')
}

async function apiGet(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  return response.json()
}
function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => refresh().catch(() => setPill('connectionState', 'API unavailable', 'bad')), 150)
}

Promise.all([
  refresh(),
  apiGet('api/recent?limit=200').then(events => Array.isArray(events) && events.forEach(add))
]).catch(() => setPill('connectionState', 'API unavailable', 'bad'))

if ('EventSource' in window) {
  const stream = new EventSource('api/stream')
  stream.onopen = () => setPill('connectionState', 'Live connection', 'ok')
  stream.onmessage = event => {
    const value = safeJson(event.data)
    if (!value) return setPill('connectionState', 'Stream data error', 'warn')
    if (value.type === 'snapshot') render(value)
    else {
      add(value)
      scheduleRefresh()
    }
  }
  stream.onerror = () => setPill('connectionState', 'Stream reconnecting', 'warn')
} else {
  setPill('connectionState', 'Polling', 'warn')
  setInterval(() => refresh().catch(() => setPill('connectionState', 'API unavailable', 'bad')), 5000)
}
$('clear').onclick = () => { rows.innerHTML = ''; rowCount = 0 }
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(paused)) }
$('eventFilter').onchange = event => { filter = event.target.value; applyFilter() }
