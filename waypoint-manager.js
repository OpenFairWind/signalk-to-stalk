'use strict'

const create82 = require('./datagrams/0x82')
const create85 = require('./datagrams/0x85')

const PATHS = {
  nextPoint: ['navigation.course.nextPoint', 'navigation.courseGreatCircle.nextPoint', 'navigation.courseRhumbline.nextPoint'],
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
  let timer
  let targetIdentity
  let announcedIdentity
  let active = false
  let lastNavigationAt = 0

  const config = {
    updateIntervalMs: numberOption(options.updateIntervalMs, 1000, 100),
    maximumAgeMs: numberOption(options.maximumAgeMs, 5000, 100),
    bearingReference: ['true', 'magnetic', 'auto'].includes(options.bearingReference) ? options.bearingReference : 'magnetic',
    waypointNameFallback: options.waypointNameFallback || 'WP',
    sendInvalidOnClear: options.sendInvalidOnClear !== false,
    sendWaypointNameOnClear: options.sendWaypointNameOnClear === true
  }

  function start() {
    for (const [field, paths] of Object.entries(PATHS)) {
      paths.forEach((path, priority) => {
        const stream = app.streambundle.getSelfStream(path)
        unsubscribes.push(stream.onValue(value => update(field, path, priority, value)))
      })
    }
    timer = setInterval(() => publishNavigation(false), config.updateIntervalMs)
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
    state[field].set(path, { value, priority, timestamp: Date.now() })
    if (field === 'nextPoint') handleTargetChange()
    else if (active) publishNavigation(false)
  }

  function current(field) {
    const entries = Array.from(state[field].values()).sort((a, b) => a.priority - b.priority)
    const selected = entries[0]
    return selected?.value == null ? undefined : selected
  }

  function handleTargetChange() {
    const target = current('nextPoint')?.value
    const identity = targetIdentityOf(target)
    if (!identity) {
      if (active && config.sendInvalidOnClear) emit('0x85', create85.invalidNavigation(), { reason: 'target-cleared' })
      if (active && config.sendWaypointNameOnClear) emit('0x82', encode82('', config.waypointNameFallback), { reason: 'target-cleared' })
      active = false
      targetIdentity = undefined
      announcedIdentity = undefined
      telemetry?.setNavigation({ active: false })
      telemetry?.record({ type: 'navigation', action: 'target-cleared' })
      return
    }
    active = true
    targetIdentity = identity
    telemetry?.record({ type: 'navigation', action: 'target-selected', targetIdentity })
    publishNavigation(true)
  }

  function publishNavigation(targetChanged) {
    if (!active) return
    const snapshot = navigationSnapshot()
    if (!snapshot) return
    const now = Date.now()
    if (now - snapshot.oldest > config.maximumAgeMs) return
    emit('0x85', encode85(snapshot.values), { reason: targetChanged ? 'target-change' : 'navigation-refresh', values: snapshot.values })
    lastNavigationAt = now
    if (targetChanged || announcedIdentity !== targetIdentity) {
      const name = resolveWaypointName(current('nextPoint')?.value, current('activeRoute')?.value, app, config.waypointNameFallback)
      emit('0x82', encode82(name, config.waypointNameFallback), { reason: 'waypoint-name', waypointName: name })
      announcedIdentity = targetIdentity
    }
    telemetry?.setNavigation({ active, targetIdentity, announcedIdentity, lastNavigationAt, ...snapshot.values })
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
      bearing = magneticBearing || (trueBearing && variation ? { value: trueBearing.value - variation.value, timestamp: Math.max(trueBearing.timestamp, variation.timestamp) } : undefined)
    } else {
      bearing = magneticBearing || trueBearing
      bearingTrue = !magneticBearing && Boolean(trueBearing)
    }
    if (!distance && !xte && !bearing) return undefined
    const timestamps = [distance, xte, bearing].filter(Boolean).map(entry => entry.timestamp)
    return {
      oldest: Math.min(...timestamps),
      values: {
        distance: distance?.value,
        crossTrackError: xte?.value,
        bearing: bearing?.value,
        bearingTrue
      }
    }
  }

  return { start, stop, getState: () => ({ active, targetIdentity, announcedIdentity, lastNavigationAt }) }
}

function targetIdentityOf(target) {
  if (!target || typeof target !== 'object') return undefined
  if (target.href) return `href:${target.href}`
  const position = target.position || target
  if (Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) {
    return `position:${position.latitude.toFixed(7)},${position.longitude.toFixed(7)}`
  }
  if (target.ID || target.id || target.name) return `name:${target.ID || target.id || target.name}`
  return undefined
}

function resolveWaypointName(target, activeRoute, app, fallback) {
  if (!target) return fallback
  for (const candidate of [target.name, target.ID, target.id]) if (candidate) return candidate
  if (target.href && typeof app.getPath === 'function') {
    try {
      const resource = app.getPath(target.href.replace(/^\//, '').replace(/^resources\//, 'resources.').replaceAll('/', '.')) || app.getPath(target.href)
      if (resource?.name) return resource.name
    } catch (error) { app.debug(`Waypoint resource lookup failed: ${error.message}`) }
  }
  const index = activeRoute?.pointIndex
  const point = Number.isInteger(index) ? activeRoute?.waypoints?.[index] : undefined
  if (point?.name || point?.ID || point?.id) return point.name || point.ID || point.id
  if (target.href) return target.href.split('/').filter(Boolean).at(-1)
  return fallback
}

function numberOption(value, fallback, minimum) {
  return Number.isFinite(value) && value >= minimum ? value : fallback
}

module.exports.targetIdentityOf = targetIdentityOf
module.exports.resolveWaypointName = resolveWaypointName
