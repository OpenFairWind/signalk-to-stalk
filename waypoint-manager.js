'use strict'

const create82 = require('./datagrams/0x82')
const create85 = require('./datagrams/0x85')
const { calculateNavigation, validatePosition } = require('./navigation-geometry')

const PATHS = {
  nextPoint: ['navigation.course.nextPoint', 'navigation.courseGreatCircle.nextPoint', 'navigation.courseRhumbline.nextPoint'],
  nextPointPosition: ['navigation.course.nextPoint.position'],
  previousPoint: ['navigation.course.previousPoint'],
  previousPointPosition: ['navigation.course.previousPoint.position'],
  vesselPosition: ['navigation.position'],
  activeRoute: ['navigation.course.activeRoute'],
  distance: ['navigation.course.calcValues.distance', 'navigation.courseGreatCircle.nextPoint.distance', 'navigation.courseRhumbline.nextPoint.distance'],
  bearingTrue: ['navigation.course.calcValues.bearingTrue', 'navigation.courseGreatCircle.nextPoint.bearingTrue', 'navigation.courseRhumbline.nextPoint.bearingToDestinationTrue'],
  bearingMagnetic: ['navigation.course.calcValues.bearingMagnetic', 'navigation.courseGreatCircle.nextPoint.bearingMagnetic', 'navigation.courseRhumbline.nextPoint.bearingToDestinationMagnetic'],
  crossTrackError: ['navigation.course.calcValues.crossTrackError', 'navigation.courseGreatCircle.crossTrackError', 'navigation.courseRhumbline.crossTrackError'],
  magneticVariation: ['navigation.magneticVariation']
}

module.exports = function createWaypointManager(app, emit, options = {}, telemetry) {
  const encode82 = create82().f
  const encode85 = create85().f
  const state = Object.fromEntries(Object.keys(PATHS).map(key => [key, new Map()]))
  const unsubscribes = []
  const now = typeof options.now === 'function' ? options.now : Date.now
  let timer
  let targetIdentity
  let announcedIdentity
  let resolvedWaypointName
  let resolvedWaypointQuality = 0
  let announcedName
  let announcedNameQuality = -1
  let active = false
  let navigationEstablished = false
  let waypointSyncPending = false
  let calculationsAvailable = false
  let lastWaypointAt = 0
  let lastNavigationAt = 0
  let lastSuppressionReason

  const config = {
    updateIntervalMs: numberOption(options.updateIntervalMs, 1000, 100),
    maximumAgeMs: numberOption(options.maximumAgeMs, 5000, 100),
    calculationSkewMs: numberOption(options.calculationSkewMs, 1000, 0),
    bearingReference: ['true', 'magnetic', 'auto'].includes(options.bearingReference) ? options.bearingReference : 'magnetic',
    waypointNameFallback: options.waypointNameFallback || 'WP',
    sendWaypointNameOnClear: options.sendWaypointNameOnClear === true
  }

  function start() {
    for (const [field, paths] of Object.entries(PATHS)) {
      paths.forEach((path, priority) => {
        const stream = app.streambundle.getSelfStream(path)
        unsubscribes.push(stream.onValue(value => update(field, path, priority, value)))
      })
    }
    timer = setInterval(refreshGuidance, config.updateIntervalMs)
    if (typeof timer.unref === 'function') timer.unref()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    unsubscribes.splice(0).forEach(unsubscribe => {
      try { unsubscribe() } catch (error) { app.error(`Waypoint unsubscribe failed: ${error.stack || error}`) }
    })
  }

  function update(field, path, priority, value) {
    state[field].set(path, { value, priority, timestamp: now(), sourcePath: path })
    if (field === 'nextPoint' || (field === 'activeRoute' && active)) handleTargetChange()
    else if (active) publishNavigation(false)
  }

  function current(field, canonicalNullIsAuthoritative = false) {
    const entries = Array.from(state[field].values()).sort((a, b) => a.priority - b.priority)
    if (canonicalNullIsAuthoritative && entries[0]?.priority === 0) return entries[0].value == null ? undefined : entries[0]
    return entries.find(entry => entry.value != null)
  }

  function handleTargetChange() {
    const target = current('nextPoint', true)?.value
    const identity = targetIdentityOf(target)
    if (!identity) {
      clearTarget()
      return
    }
    const resolved = resolveWaypoint(target, current('activeRoute')?.value, app, config.waypointNameFallback)
    const name = resolved.name
    const targetChanged = !active || identity !== targetIdentity
    const replacedTarget = active && identity !== targetIdentity
    if (replacedTarget) clearNavigationCalculations()
    active = true
    targetIdentity = identity
    resolvedWaypointName = name
    resolvedWaypointQuality = resolved.quality
    if (targetChanged) {
      navigationEstablished = false
      waypointSyncPending = false
      calculationsAvailable = false
      lastNavigationAt = 0
    }
    if (targetChanged) telemetry?.record({ type: 'navigation', action: 'target-selected', targetIdentity })
    const navigationSent = publishNavigation(targetChanged)
    if (!navigationSent && !targetChanged && navigationEstablished && announcedName !== name && resolved.quality >= announcedNameQuality) {
      announceWaypoint(name, resolved.quality, 'waypoint-name-change')
    }
  }

  function announceWaypoint(name, quality, reason) {
    emit('0x82', encode82(name, config.waypointNameFallback), { reason, waypointName: name, targetIdentity })
    announcedIdentity = targetIdentity
    announcedName = name
    announcedNameQuality = quality
    lastWaypointAt = now()
    if (!navigationEstablished && reason !== 'navigation-sync') waypointSyncPending = true
    telemetry?.record({ type: 'navigation', action: reason === 'waypoint-name-change' ? 'waypoint-name-updated' : 'waypoint-announced', targetIdentity, waypointName: name })
    updateTelemetry()
  }

  function clearTarget() {
    if (!active) return
    if (config.sendWaypointNameOnClear) emit('0x82', encode82('', config.waypointNameFallback), { reason: 'target-cleared' })
    active = false
    navigationEstablished = false
    waypointSyncPending = false
    targetIdentity = undefined
    announcedIdentity = undefined
    resolvedWaypointName = undefined
    resolvedWaypointQuality = 0
    announcedName = undefined
    announcedNameQuality = -1
    calculationsAvailable = false
    clearNavigationCalculations()
    lastWaypointAt = 0
    lastNavigationAt = 0
    lastSuppressionReason = undefined
    updateTelemetry()
    telemetry?.record({ type: 'navigation', action: 'target-cleared' })
  }

  function publishNavigation(targetChanged) {
    if (!active) return false
    let snapshot = navigationSnapshot()
    if (!snapshot) return suppressNavigation(navigationUnavailableReason())
    const emittedAt = now()
    if (snapshot.source !== 'local-fallback' && (emittedAt - snapshot.oldest > config.maximumAgeMs || snapshot.newest - snapshot.oldest > config.calculationSkewMs)) {
      const fallback = localNavigationSnapshot()
      if (fallback && emittedAt - fallback.oldest <= config.maximumAgeMs && fallback.newest - fallback.oldest <= config.calculationSkewMs) snapshot = fallback
    }
    if (emittedAt - snapshot.oldest > config.maximumAgeMs) return suppressNavigation('stale-navigation-data', { ageMs: emittedAt - snapshot.oldest })
    if (snapshot.newest - snapshot.oldest > config.calculationSkewMs) return suppressNavigation('navigation-data-skew', { skewMs: snapshot.newest - snapshot.oldest })
    if (!targetChanged && lastNavigationAt && emittedAt - lastNavigationAt < config.updateIntervalMs) return false
    const invalidReason = validateNavigation(snapshot.values)
    if (invalidReason) return suppressNavigation(invalidReason)
    calculationsAvailable = true
    lastSuppressionReason = undefined
    emit('0x85', encode85(snapshot.values), { reason: targetChanged ? 'target-change' : 'navigation-refresh', values: snapshot.values, navigationSource: snapshot.source, targetIdentity })
    lastNavigationAt = emittedAt
    telemetry?.record({ type: 'navigation', action: 'navigation-emitted', targetIdentity, source: snapshot.source })
    updateTelemetry({ ...snapshot.values, navigationSource: snapshot.source })
    const synchronizeWaypoint = waypointSyncPending && announcedIdentity === targetIdentity
    navigationEstablished = true
    if (announcedIdentity !== targetIdentity || announcedName !== resolvedWaypointName) {
      announceWaypoint(resolvedWaypointName, resolvedWaypointQuality,
        'target-change')
      waypointSyncPending = false
    } else if (synchronizeWaypoint) {
      announceWaypoint(resolvedWaypointName, resolvedWaypointQuality, 'navigation-sync')
      waypointSyncPending = false
    }
    return true
  }

  function refreshGuidance() {
    if (!active) return
    publishNavigation(false)
  }

  function clearNavigationCalculations() {
    for (const field of ['distance', 'bearingTrue', 'bearingMagnetic', 'crossTrackError']) state[field].clear()
  }

  function suppressNavigation(reason, details = {}) {
    calculationsAvailable = false
    lastSuppressionReason = reason
    telemetry?.record({ type: 'navigation', action: 'navigation-suppressed', reason, targetIdentity, ...details })
    updateTelemetry()
    return false
  }

  function updateTelemetry(values = {}) {
    telemetry?.setNavigation({
      active, targetIdentity, resolvedWaypointName, announcedIdentity, announcedName,
      calculationsAvailable, lastWaypointAt, lastNavigationAt, lastSuppressionReason, ...values
    })
  }

  function navigationSnapshot() {
    const distance = current('distance')
    const xte = current('crossTrackError')
    const trueBearing = current('bearingTrue')
    const magneticBearing = current('bearingMagnetic')
    const variation = current('magneticVariation')
    let bearing
    let bearingTrue = false
    if (config.bearingReference === 'true') {
      bearing = trueBearing
      bearingTrue = true
    } else if (config.bearingReference === 'magnetic') {
      bearing = magneticBearing || (trueBearing && variation
        ? { value: trueBearing.value - variation.value, timestamps: [trueBearing.timestamp, variation.timestamp] }
        : trueBearing)
      bearingTrue = !magneticBearing && !variation && Boolean(trueBearing)
    } else {
      bearing = magneticBearing || trueBearing
      bearingTrue = !magneticBearing && Boolean(trueBearing)
    }
    if (!distance || !xte || !bearing) return localNavigationSnapshot()
    const timestamps = [distance, xte, ...(bearing.timestamps || [bearing.timestamp])].filter(Boolean).map(entry => typeof entry === 'number' ? entry : entry.timestamp)
    return {
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
      source: distance.priority === 0 && xte.priority === 0 && (trueBearing?.priority === 0 || magneticBearing?.priority === 0) ? 'calcValues' : 'legacy-course',
      values: {
        distance: distance?.value,
        crossTrackError: xte?.value,
        bearing: bearing?.value,
        bearingTrue
      }
    }
  }

  function localNavigationSnapshot() {
    const vessel = current('vesselPosition')
    const target = current('nextPoint', true)
    const explicitTargetPosition = current('nextPointPosition')
    const targetPosition = explicitTargetPosition?.value || target?.value?.position
    const previous = current('previousPointPosition') || current('previousPoint')
    const previousPosition = previous?.value?.position || previous?.value
    if (!vessel || !targetPosition) return undefined
    try {
      validatePosition(vessel.value, 'navigation.position')
      validatePosition(targetPosition, 'navigation.course.nextPoint.position')
      if (previousPosition) validatePosition(previousPosition, 'navigation.course.previousPoint.position')
      const values = calculateNavigation(vessel.value, targetPosition, previousPosition)
      const timestamps = [vessel.timestamp, explicitTargetPosition?.timestamp || target.timestamp]
      if (previousPosition) timestamps.push(previous.timestamp)
      return { oldest: Math.min(...timestamps), newest: Math.max(...timestamps), source: 'local-fallback', values: { distance: values.distance, bearing: values.bearingTrue, crossTrackError: values.crossTrackError, bearingTrue: true } }
    } catch (error) {
      return undefined
    }
  }

  function navigationUnavailableReason() {
    const target = current('nextPoint', true)?.value
    if (!target) return 'missing-next-point'
    const targetPosition = current('nextPointPosition')?.value || target.position
    if (!targetPosition) return 'missing-next-point-position'
    if (!current('vesselPosition')) return 'missing-vessel-position'
    return 'invalid-coordinate'
  }

  return { start, stop, getState: () => ({ active, targetIdentity, resolvedWaypointName, announcedIdentity, announcedName, calculationsAvailable, lastWaypointAt, lastNavigationAt, lastSuppressionReason }) }
}

function validateNavigation({ distance, crossTrackError, bearing }) {
  if (![distance, crossTrackError, bearing].every(Number.isFinite)) return 'navigation-invalid'
  if (distance < 0 || distance / 1852 * 10 > 0x0fff) return 'distance-out-of-range'
  if (Math.abs(crossTrackError) / 1852 * 100 > 0x0fff) return 'cross-track-error-out-of-range'
  return undefined
}

function targetIdentityOf(target) {
  if (!target || typeof target !== 'object') return undefined
  if (typeof target.href === 'string' && target.href.trim()) return `href:${target.href.trim()}`
  const explicitId = target.ID ?? target.id
  if (explicitId != null && String(explicitId).trim()) return `id:${String(explicitId).trim()}`
  const position = target.position || target
  if (Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) {
    return `position:${position.latitude.toFixed(7)},${position.longitude.toFixed(7)}`
  }
  if (typeof target.name === 'string' && target.name.trim()) return `name:${target.name.trim()}`
  return undefined
}

function resolveWaypointName(target, activeRoute, app, fallback) {
  return resolveWaypoint(target, activeRoute, app, fallback).name
}

function resolveWaypoint(target, activeRoute, app, fallback) {
  if (!target) return { name: fallback, quality: 0 }
  for (const candidate of [target.name, target.ID, target.id]) if (candidate) return { name: candidate, quality: 4 }
  if (target.href && typeof app.getPath === 'function') {
    try {
      const resource = app.getPath(target.href.replace(/^\//, '').replace(/^resources\//, 'resources.').replaceAll('/', '.')) || app.getPath(target.href)
      if (resource?.name) return { name: resource.name, quality: 3 }
    } catch (error) { app.debug(`Waypoint resource lookup failed: ${error.message}`) }
  }
  const index = activeRoute?.pointIndex
  const point = Number.isInteger(index) ? activeRoute?.waypoints?.[index] : undefined
  if (point?.name || point?.ID || point?.id) return { name: point.name || point.ID || point.id, quality: 2 }
  if (target.href) {
    const segment = target.href.split('/').filter(Boolean).at(-1)
    if (segment) return { name: segment, quality: 1 }
  }
  return { name: fallback, quality: 0 }
}

function numberOption(value, fallback, minimum) {
  return Number.isFinite(value) && value >= minimum ? value : fallback
}

module.exports.targetIdentityOf = targetIdentityOf
module.exports.resolveWaypointName = resolveWaypointName
