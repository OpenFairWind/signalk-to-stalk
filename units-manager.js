'use strict'

const SPEED_PATHS = ['navigation.speedOverGround', 'navigation.speedThroughWater']
const DISTANCE_PATHS = ['navigation.log', 'navigation.trip.log']

module.exports = function createUnitsManager(app, emitDatagram, encoder, options = {}, telemetry) {
  let timer
  let lastSystem

  const settings = {
    source: options.source || 'signalKPreferences',
    speedAndDistance: options.speedAndDistance || 'auto',
    pollIntervalMs: finiteOr(options.pollIntervalMs, 5000),
    periodicRefreshSeconds: finiteOr(options.periodicRefreshSeconds, 0),
    sendOnStartup: options.sendOnStartup !== false,
    resendOnChange: options.resendOnChange !== false
  }

  function start() {
    if (settings.sendOnStartup) evaluate(true)
    if (settings.resendOnChange || settings.periodicRefreshSeconds > 0) {
      timer = setInterval(() => evaluate(false), Math.max(1000, settings.pollIntervalMs))
      if (typeof timer.unref === 'function') timer.unref()
    }
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    lastSystem = undefined
  }

  function evaluate(force) {
    try {
      const system = resolveUnitSystem(app, settings)
      if (!system) {
        app.debug('No coherent SeaTalk speed/distance unit preference could be resolved')
        return
      }
      const refreshMs = settings.periodicRefreshSeconds > 0 ? settings.periodicRefreshSeconds * 1000 : 0
      const refreshDue = refreshMs > 0 && (!evaluate.lastSentAt || Date.now() - evaluate.lastSentAt >= refreshMs)
      const changed = system !== lastSystem
      if (force || (settings.resendOnChange && changed) || refreshDue) {
        emitDatagram('0x24', encoder.f(system), { reason: force ? 'unit-startup' : (changed ? 'unit-change' : 'unit-refresh'), unitSystem: system })
        lastSystem = system
        evaluate.lastSentAt = Date.now()
        telemetry?.setUnits({ system, lastSentAt: evaluate.lastSentAt, source: settings.source })
      }
    } catch (error) {
      const message = `Failed to synchronize SeaTalk units: ${error.message}`
      app.error(error.stack ? `${message}\n${error.stack}` : message)
      telemetry?.record({ type: 'error', component: 'units', message })
      if (typeof app.setPluginError === 'function') app.setPluginError(message)
    }
  }

  return { start, stop, evaluate }
}

function resolveUnitSystem(app, settings) {
  if (settings.source === 'configuration') {
    return settings.speedAndDistance === 'auto'
      ? 'nautical'
      : normalizeExplicit(settings.speedAndDistance)
  }
  if (settings.speedAndDistance !== 'auto') return normalizeExplicit(settings.speedAndDistance)

  const preferences = getPreferences(app)
  const speed = firstUnit([
    preferences.speed,
    preferences.speedOverGround,
    ...SPEED_PATHS.map(path => metadataUnit(app, path))
  ])
  const distance = firstUnit([
    preferences.distance,
    preferences.length,
    ...DISTANCE_PATHS.map(path => metadataUnit(app, path))
  ])

  const speedSystem = speedToSystem(speed)
  const distanceSystem = distanceToSystem(distance)
  if (speedSystem && distanceSystem && speedSystem !== distanceSystem) {
    app.error(`Signal K speed unit '${speed}' and distance unit '${distance}' cannot be represented coherently by SeaTalk 0x24`)
    return undefined
  }
  return speedSystem || distanceSystem || 'nautical'
}

function getPreferences(app) {
  for (const getter of ['getUnitPreferences', 'getUnitPreferencesActive']) {
    if (typeof app[getter] === 'function') {
      const value = app[getter]()
      if (value && typeof value === 'object') return flattenPreferences(value)
    }
  }
  return {}
}

function flattenPreferences(value) {
  const result = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') result[key] = entry
    else if (entry && typeof entry === 'object') result[key] = entry.targetUnit || entry.unit || entry.symbol
  }
  return result
}

function metadataUnit(app, path) {
  if (typeof app.getMetadata !== 'function') return undefined
  const metadata = app.getMetadata(path)
  if (!metadata) return undefined
  const display = metadata.displayUnits
  if (typeof display === 'string') return display
  if (display && typeof display === 'object') return display.targetUnit || display.unit || display.symbol
  return undefined
}

function firstUnit(values) {
  return values.find(value => typeof value === 'string' && value.trim())
}

function speedToSystem(unit) {
  if (!unit) return undefined
  const value = canonical(unit)
  if (['kn', 'knot', 'knots', 'kt', 'kts'].includes(value)) return 'nautical'
  if (['mph', 'mi/h', 'mileperhour', 'milesperhour'].includes(value)) return 'statute'
  if (['km/h', 'kph', 'kmh', 'kilometreperhour', 'kilometerperhour'].includes(value)) return 'metric'
  return undefined
}

function distanceToSystem(unit) {
  if (!unit) return undefined
  const value = canonical(unit)
  if (['nm', 'nmi', 'nauticalmile', 'nauticalmiles'].includes(value)) return 'nautical'
  if (['mi', 'mile', 'miles'].includes(value)) return 'statute'
  if (['km', 'kilometre', 'kilometres', 'kilometer', 'kilometers'].includes(value)) return 'metric'
  return undefined
}

function normalizeExplicit(value) {
  if (!['nautical', 'statute', 'metric'].includes(value)) {
    throw new RangeError('speedAndDistance must be nautical, statute, or metric when using a fixed configuration')
  }
  return value
}

function canonical(value) {
  return value.toLowerCase().replace(/\s+/g, '')
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

module.exports.resolveUnitSystem = resolveUnitSystem
module.exports.speedToSystem = speedToSystem
module.exports.distanceToSystem = distanceToSystem
