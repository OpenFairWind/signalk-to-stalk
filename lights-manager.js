'use strict'

module.exports = function createLightsManager(app, emitDatagram, encoder, options = {}, telemetry) {
  let unsubscribe
  let lastLevel
  let lastSentAt = 0

  const settings = {
    source: options.source || 'signalKPath',
    signalKPath: options.signalKPath || 'electrical.switches.seatalkDisplayLights.dimmingLevel',
    valueFormat: options.valueFormat || 'auto',
    configuredLevel: Number.isFinite(options.configuredLevel) ? options.configuredLevel : 3,
    sendOnStartup: options.sendOnStartup !== false,
    resendOnChange: options.resendOnChange !== false,
    minimumIntervalMs: finiteOr(options.minimumIntervalMs, 250),
    invert: options.invert === true
  }

  function start() {
    if (settings.source === 'configuration') {
      if (settings.sendOnStartup) processValue(settings.configuredLevel, 'lights-startup')
      return
    }

    if (settings.sendOnStartup && typeof app.getSelfPath === 'function') {
      const initial = app.getSelfPath(settings.signalKPath)
      if (initial !== undefined && initial !== null) processValue(initial, 'lights-startup')
    }

    if (settings.resendOnChange && app.streambundle?.getSelfStream) {
      let stream = app.streambundle.getSelfStream(settings.signalKPath)
      if (typeof stream.changes === 'function') stream = stream.changes()
      if (typeof stream.debounceImmediate === 'function') stream = stream.debounceImmediate(20)
      if (typeof stream.onValue === 'function') unsubscribe = stream.onValue(value => processValue(value, 'lights-change'))
    }
  }

  function stop() {
    if (unsubscribe) {
      try { unsubscribe() } catch (error) { app.error(`Display-light unsubscribe failed: ${error.stack || error}`) }
    }
    unsubscribe = undefined
    lastLevel = undefined
    lastSentAt = 0
  }

  function processValue(value, reason = 'lights-change') {
    try {
      let level = brightnessToLevel(value, settings.valueFormat)
      if (settings.invert) level = 3 - level
      const now = Date.now()
      if (level === lastLevel) {
        telemetry?.record({ type: 'suppressed', component: 'lights', reason: 'duplicate-light-level', level })
        return false
      }
      if (lastSentAt && now - lastSentAt < settings.minimumIntervalMs) {
        telemetry?.record({ type: 'suppressed', component: 'lights', reason: 'light-rate-limit', level })
        return false
      }
      emitDatagram('0x30', encoder.f(level), {
        reason,
        lightLevel: level,
        sourcePath: settings.source === 'signalKPath' ? settings.signalKPath : undefined,
        sourceValue: value
      })
      lastLevel = level
      lastSentAt = now
      telemetry?.setLights({ level, source: settings.source, path: settings.signalKPath, lastSentAt: now })
      return true
    } catch (error) {
      const message = `Failed to synchronize SeaTalk display lights: ${error.message}`
      app.error(error.stack ? `${message}\n${error.stack}` : message)
      telemetry?.record({ type: 'error', component: 'lights', message })
      if (typeof app.setPluginError === 'function') app.setPluginError(message)
      return false
    }
  }

  return { start, stop, processValue, settings }
}

function brightnessToLevel(value, format = 'auto') {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'value')) value = value.value
  if (!Number.isFinite(value)) throw new TypeError('brightness must be a finite number')

  let selected = format
  if (selected === 'auto') {
    if (Number.isInteger(value) && value >= 0 && value <= 3) selected = 'level'
    else if (value >= 0 && value <= 1) selected = 'ratio'
    else if (value >= 0 && value <= 100) selected = 'percent'
    else throw new RangeError('automatic brightness values must be 0..1, 0..3 integer, or 0..100')
  }

  if (selected === 'level') {
    if (!Number.isInteger(value) || value < 0 || value > 3) throw new RangeError('level brightness must be an integer from 0 to 3')
    return value
  }

  let ratio
  if (selected === 'ratio') {
    if (value < 0 || value > 1) throw new RangeError('ratio brightness must be between 0 and 1')
    ratio = value
  } else if (selected === 'percent') {
    if (value < 0 || value > 100) throw new RangeError('percent brightness must be between 0 and 100')
    ratio = value / 100
  } else {
    throw new RangeError('valueFormat must be auto, ratio, percent, or level')
  }
  if (ratio <= 0) return 0
  if (ratio <= 1 / 3) return 1
  if (ratio <= 2 / 3) return 2
  return 3
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

module.exports.brightnessToLevel = brightnessToLevel
