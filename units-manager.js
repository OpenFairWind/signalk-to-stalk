'use strict'

const SPEED_PATHS = ['navigation.speedOverGround', 'navigation.speedThroughWater']
const DISTANCE_PATHS = ['navigation.log', 'navigation.trip.log']

module.exports = function createUnitsManager(app, emitDatagram, encoder, options = {}, telemetry) {
  let timer
  let lastSystem
  let lastSentAt
  const now = typeof options.now === 'function' ? options.now : Date.now

  const settings = {
    source: options.source || 'signalKPreferences',
    speedAndDistance: options.speedAndDistance || 'auto',
    pollIntervalMs: finiteOr(options.pollIntervalMs, 5000),
    periodicRefreshSeconds: finiteOr(options.periodicRefreshSeconds, 0),
    sendOnStartup: options.sendOnStartup !== false,
    resendOnChange: options.resendOnChange !== false
  }

  // Change detection only applies to Signal K preferences; a fixed setting
  // cannot change while the plugin runs.
  const detectsChanges = settings.resendOnChange && settings.source !== 'configuration'

  function start() {
    if (settings.sendOnStartup) evaluate(true)
    const intervalMs = timerIntervalMs()
    if (intervalMs) {
      timer = setInterval(() => evaluate(false), intervalMs)
      if (typeof timer.unref === 'function') timer.unref()
    }
  }

  function timerIntervalMs() {
    const refreshMs = settings.periodicRefreshSeconds > 0 ? settings.periodicRefreshSeconds * 1000 : 0
    const candidates = []
    if (detectsChanges) candidates.push(settings.pollIntervalMs)
    if (refreshMs) candidates.push(refreshMs)
    return candidates.length ? Math.max(1000, Math.min(...candidates)) : 0
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    lastSystem = undefined
    lastSentAt = undefined
  }

  function evaluate(force) {
    try {
      const refreshMs = settings.periodicRefreshSeconds > 0 ? settings.periodicRefreshSeconds * 1000 : 0
      const refreshDue = refreshMs > 0 && (lastSentAt === undefined || now() - lastSentAt >= refreshMs)
      // With change detection disabled, a periodic refresh repeats the system
      // already sent instead of indirectly publishing a newly resolved one.
      const system = !force && !detectsChanges && lastSystem !== undefined
        ? lastSystem
        : resolveUnitSystem(app, settings)
      if (!system) {
        app.debug('No coherent SeaTalk speed/distance unit preference could be resolved')
        return
      }
      const changed = system !== lastSystem
      if (force || (detectsChanges && changed) || refreshDue) {
        const reason = force ? 'unit-startup' : (detectsChanges && changed ? 'unit-change' : 'unit-refresh')
        emitDatagram('0x24', encoder.f(system), { reason, unitSystem: system })
        lastSystem = system
        lastSentAt = now()
        telemetry?.setUnits({ system, lastSentAt, source: settings.source })
      }
    } catch (error) {
      const message = `Failed to synchronize SeaTalk units: ${error.message}`
      app.error(error.stack ? `${message}\n${error.stack}` : message)
      telemetry?.record({ type: 'error', component: 'units', message })
      if (typeof app.setPluginError === 'function') app.setPluginError(message)
    }
  }

  return { start, stop, evaluate, timerIntervalMs }
}

function resolveUnitSystem(app, settings) {
  if (settings.source === 'configuration') {
    return settings.speedAndDistance === 'auto'
      ? 'nautical'
      : normalizeExplicit(settings.speedAndDistance)
  }
  // speedAndDistance is used only by the fixed source. The Signal K admin UI
  // stores the schema default ('nautical') even when preferences are selected,
  // so honouring it here would silently disable preference resolution.

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
