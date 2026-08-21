'use strict'
const Bacon = require('baconjs')
const fs = require('fs')
const path = require('path')
const createWaypointManager = require('./waypoint-manager')
const createUnitsManager = require('./units-manager')
const createLightsManager = require('./lights-manager')
const createTelemetry = require('./telemetry')
const createCalibrationManager = require('./calibration-manager')

module.exports = function createPlugin(app) {
  const plugin = {
    id: 'signalk-to-stalk',
    name: 'Convert Signal K to STALK',
    description: 'Convert Signal K navigation data to SeaTalk1 datagrams wrapped as STALK NMEA 0183 sentences.',
    unsubscribes: [],
    waypointManager: undefined,
    unitsManager: undefined,
    lightsManager: undefined,
    calibrationManager: undefined,
    telemetry: createTelemetry({ capacity: 1000 }),
    schema: {
      type: 'object',
      title: 'Signal K to SeaTalk1',
      description: 'Configure direct Signal K-to-SeaTalk conversions and managed services. Settings are read-only from the WebApp; changes are made here in the Signal K plugin settings.',
      additionalProperties: false,
      properties: {},
      propertyOrder: []
    }
  }

  plugin.registerWithRouter = function registerWithRouter(router) {
    router.get('/api/status', (_req, res) => res.json(plugin.telemetry.snapshot()))
    router.get('/api/recent', (req, res) => res.json(plugin.telemetry.recent(req.query?.limit)))
    router.get('/api/stream', (req, res) => plugin.telemetry.attachSse(req, res))
  }

  plugin.stop = function stop() {
    plugin.unsubscribes.splice(0).forEach(unsubscribe => {
      try { unsubscribe() } catch (error) { app.error(`Unsubscribe failed: ${error.stack || error}`) }
    })
    if (plugin.waypointManager) plugin.waypointManager.stop()
    if (plugin.unitsManager) plugin.unitsManager.stop()
    if (plugin.lightsManager) plugin.lightsManager.stop()
    if (plugin.calibrationManager) plugin.calibrationManager.stop()
    plugin.waypointManager = undefined
    plugin.unitsManager = undefined
    plugin.lightsManager = undefined
    plugin.calibrationManager = undefined
    plugin.telemetry.stop()
    if (typeof app.setPluginStatus === 'function') app.setPluginStatus('Stopped')
  }

  plugin.start = function start(options = {}) {
    validateCurrentConfiguration(options, plugin.schema)
    plugin.stop()
    try {
      plugin.telemetry.setConfiguration(configurationSummary(options, plugin.datagrams))
      let active = 0
      Object.keys(plugin.datagrams).forEach(name => {
        if (plugin.datagrams[name].managed || !options[name]) return
        subscribe(plugin.datagrams[name], options[getThrottleProperty(name)])
        active += 1
      })
      if (options.instrumentUnits?.enabled && plugin.datagrams['0x24']) {
        plugin.unitsManager = createUnitsManager(app, emitDatagram, plugin.datagrams['0x24'], options.instrumentUnits, plugin.telemetry)
        plugin.unitsManager.start()
        active += 1
      }
      if (options.instrumentLights?.enabled && plugin.datagrams['0x30']) {
        plugin.lightsManager = createLightsManager(app, emitDatagram, plugin.datagrams['0x30'], options.instrumentLights, plugin.telemetry)
        plugin.lightsManager.start()
        active += 1
      }
      if (options.calibrationAdvisor?.enabled) {
        plugin.calibrationManager = createCalibrationManager(app, options.calibrationAdvisor, plugin.telemetry)
        plugin.calibrationManager.start()
        active += 1
      }
      if (options.navigationToWaypoint?.enabled) {
        plugin.waypointManager = createWaypointManager(app, emitDatagram, options.navigationToWaypoint, plugin.telemetry)
        plugin.waypointManager.start()
        active += 2
      }
      const status = `Running with ${active} datagram${active === 1 ? '' : 's'} enabled`
      plugin.telemetry.setRunning(true, status)
      plugin.telemetry.record({ type: 'lifecycle', action: 'start', active })
      if (typeof app.setPluginStatus === 'function') app.setPluginStatus(status)
    } catch (error) {
      plugin.stop()
      throw error
    }
  }

  function subscribe(encoder, throttleMs) {
    const streams = encoder.keys.map((key, index) => {
      let stream = app.streambundle.getSelfStream(key)
      if (encoder.defaults && encoder.defaults[index] !== undefined) stream = stream.merge(Bacon.once(encoder.defaults[index]))
      return stream
    })

    let stream = Bacon.combineWith((...values) => {
      try {
        return encoder.f(...values)
      } catch (error) {
        const message = `Failed to encode ${encoder.datagram}: ${error.message}`
        app.error(error.stack ? `${message}\n${error.stack}` : message)
        plugin.telemetry.record({ type: 'error', datagram: encoder.datagram, message })
        if (typeof app.setPluginError === 'function') app.setPluginError(message)
        return undefined
      }
    }, streams).filter(value => value !== undefined).changes().debounceImmediate(20)

    if (Number.isFinite(throttleMs) && throttleMs > 0) stream = stream.throttle(throttleMs)
    const unsubscribe = stream.onValue(sentence => emitDatagram(encoder.datagram, sentence))
    plugin.unsubscribes.push(unsubscribe)
  }

  function emitDatagram(datagram, sentence, details = {}) {
    plugin.telemetry.record({ type: 'emitted', datagram, sentence: sentence.trimEnd(), bytes: sentenceBytes(sentence), ...details })
    app.emit('stalkout', sentence)
    app.emit(`stalkout:${datagram.slice(2).toUpperCase()}`, sentence)
    app.debug(sentence.trimEnd())
  }

  plugin.datagrams = loadDatagrams(app, plugin)
  buildSchema(plugin)
  return plugin
}

function loadDatagrams(app, plugin) {
  const directory = path.join(__dirname, 'datagrams')
  return fs.readdirSync(directory).filter(name => /^0x[0-9a-f]+\.js$/i.test(name)).sort().reduce((result, filename) => {
    const key = path.basename(filename, '.js')
    result[key] = require(path.join(directory, filename))(app, plugin)
    return result
  }, {})
}

function buildSchema(plugin) {
  const properties = plugin.schema.properties

  Object.keys(plugin.datagrams).forEach(key => {
    const encoder = plugin.datagrams[key]
    if (encoder.managed) return
    const paths = Array.isArray(encoder.keys) ? encoder.keys.join(', ') : 'the required Signal K paths'
    properties[key] = {
      title: `${encoder.title} (${key})`,
      description: `Enable conversion from ${paths}. Output is emitted as a $STALK sentence on the stalkout event.`,
      type: 'boolean',
      default: false
    }
    properties[getThrottleProperty(key)] = {
      title: `${encoder.title}: minimum interval`,
      description: `Minimum interval between emitted ${key} datagrams, in milliseconds. Set to 0 to emit every accepted value change.`,
      type: 'integer',
      minimum: 0,
      default: 0
    }
    plugin.schema.propertyOrder.push(key, getThrottleProperty(key))
  })

  properties.navigationToWaypoint = {
    type: 'object',
    title: 'Waypoint guidance (0x82 / 0x85)',
    description: 'Broadcast passive navigation guidance for the active Signal K target. This does not engage or control the autopilot.',
    additionalProperties: false,
    default: {},
    properties: {
      enabled: {
        type: 'boolean', default: false,
        title: 'Enable target waypoint guidance',
        description: 'Send 0x85 navigation data and announce target changes with 0x82.'
      },
      updateIntervalMs: {
        type: 'integer', minimum: 100, default: 1000,
        title: 'Navigation refresh interval',
        description: 'How often to repeat valid 0x85 navigation data while a target is active, in milliseconds.'
      },
      maximumAgeMs: {
        type: 'integer', minimum: 100, default: 5000,
        title: 'Maximum navigation-data age',
        description: 'Suppress navigation output when required Signal K values are older than this limit, in milliseconds.'
      },
      calculationSkewMs: {
        type: 'integer', minimum: 0, default: 1000,
        title: 'Maximum calculation timestamp skew',
        description: 'Suppress 0x85 when its distance, cross-track error, and bearing timestamps differ by more than this many milliseconds.'
      },
      bearingReference: {
        type: 'string', enum: ['magnetic', 'true', 'auto'], default: 'magnetic',
        enumNames: ['Magnetic', 'True', 'Automatic'],
        title: 'Bearing reference',
        description: 'Automatic prefers magnetic bearing and falls back to true bearing.'
      },
      waypointNameFallback: {
        type: 'string', minLength: 1, maxLength: 32, default: 'WP',
        title: 'Fallback waypoint name',
        description: 'Used when Signal K provides no target name. SeaTalk transmits the final four representable characters.'
      },
      sendInvalidOnClear: {
        type: 'boolean', enum: [false], default: false,
        title: 'Send invalid navigation on clear (retired)',
        description: 'Must remain disabled. SeaTalk 0x85 has no safe passive invalid-data mode; older releases could generate instrument data errors.'
      },
      sendWaypointNameOnClear: {
        type: 'boolean', default: false,
        title: 'Also send fallback name when target is cleared',
        description: 'Normally disabled because older instruments may treat a name-only update as a new target.'
      }
    }
  }

  properties.instrumentUnits = {
    type: 'object',
    additionalProperties: false,
    title: 'Display units (0x24)',
    description: 'Best-effort network-wide synchronization of the SeaTalk speed/log unit system. Signal K values remain in SI units.',
    default: {},
    properties: {
      enabled: {
        type: 'boolean', default: false,
        title: 'Enable display-unit synchronization'
      },
      source: {
        type: 'string', enum: ['signalKPreferences', 'configuration'], default: 'signalKPreferences',
        enumNames: ['Signal K unit preferences', 'Fixed plugin setting'],
        title: 'Unit preference source'
      },
      speedAndDistance: {
        type: 'string', enum: ['nautical', 'statute', 'metric'], default: 'nautical',
        enumNames: ['Nautical miles and knots', 'Statute miles and mph', 'Kilometres and km/h'],
        title: 'SeaTalk unit system',
        description: 'Used only when the source is Fixed plugin setting. Signal K preferences are resolved automatically when that source is selected.'
      },
      sendOnStartup: {
        type: 'boolean', default: true,
        title: 'Send current units at startup'
      },
      resendOnChange: {
        type: 'boolean', default: true,
        title: 'Detect and send preference changes',
        description: 'Poll Signal K preferences and emit 0x24 only when the resolved system changes.'
      },
      pollIntervalMs: {
        type: 'integer', minimum: 1000, default: 5000,
        title: 'Preference polling interval',
        description: 'How often Signal K unit preferences are checked, in milliseconds. Used only for the Signal K preferences source.'
      },
      periodicRefreshSeconds: {
        type: 'integer', minimum: 0, default: 0,
        title: 'Periodic unit refresh',
        description: 'Repeat the resolved 0x24 setting after this many seconds. Set to 0 to disable periodic refresh.'
      }
    }
  }



  properties.calibrationAdvisor = {
    type: 'object',
    title: 'Speed and heading calibration advisor',
    description: 'Read-only estimates for instrument calibration. Speed uses water speed versus GPS speed; heading uses magnetic heading versus variation-corrected GPS course. Validate in slack water and with reciprocal runs.',
    additionalProperties: false,
    default: {},
    properties: {
      enabled: { type: 'boolean', default: false, title: 'Enable calibration advisor' },
      measuredPath: { type: 'string', minLength: 1, default: 'navigation.speedThroughWater', title: 'Measured speed path' },
      referencePath: { type: 'string', minLength: 1, default: 'navigation.speedOverGround', title: 'Reference speed path' },
      currentCalibrationFactor: { type: 'number', exclusiveMinimum: 0, default: 1, title: 'Current ST60 calibration factor', description: 'Enter the factor currently shown by the instrument. The advisor multiplies it by the observed correction ratio.' },
      minimumSpeedMps: { type: 'number', minimum: 0.5, default: 1.5, title: 'Minimum accepted speed', description: 'Samples below this speed are ignored. Value is metres per second (1.5 m/s is about 2.9 kn).' },
      minimumSamples: { type: 'integer', minimum: 10, default: 30, title: 'Minimum samples for a suggestion' },
      windowSize: { type: 'integer', minimum: 20, maximum: 1000, default: 120, title: 'Rolling sample-window size' },
      maximumRelativeSpread: { type: 'number', minimum: 0.01, maximum: 0.5, default: 0.08, title: 'Maximum relative spread', description: 'Lower values require more stable observations before marking the suggestion ready.' },
      headingEnabled: { type: 'boolean', default: true, title: 'Enable heading calibration suggestion' },
      headingMeasuredPath: { type: 'string', minLength: 1, default: 'navigation.headingMagnetic', title: 'Measured magnetic heading path' },
      headingReferencePath: { type: 'string', minLength: 1, default: 'navigation.courseOverGroundTrue', title: 'GPS course reference path' },
      headingVariationPath: { type: 'string', minLength: 1, default: 'navigation.magneticVariation', title: 'Magnetic variation path' },
      headingSpeedPath: { type: 'string', minLength: 1, default: 'navigation.speedOverGround', title: 'Heading-advisor speed path' },
      currentHeadingOffsetDegrees: { type: 'number', minimum: -180, maximum: 180, default: 0, title: 'Current heading alignment offset (degrees)' },
      headingMinimumSpeedMps: { type: 'number', minimum: 0.5, default: 2, title: 'Minimum speed for heading samples (m/s)' },
      headingMinimumSamples: { type: 'integer', minimum: 10, default: 30, title: 'Minimum heading samples' },
      headingWindowSize: { type: 'integer', minimum: 20, maximum: 1000, default: 120, title: 'Heading sample-window size' },
      headingMaximumSpreadDegrees: { type: 'number', minimum: 0.5, maximum: 45, default: 5, title: 'Maximum heading spread (degrees)' }
    }
  }

  properties.instrumentLights = {
    type: 'object',
    title: 'Display lighting (0x30)',
    description: 'Synchronize all compatible SeaTalk display lamps to one of four broadcast levels, L0 through L3.',
    additionalProperties: false,
    default: {},
    properties: {
      enabled: {
        type: 'boolean', default: false,
        title: 'Enable display-light synchronization'
      },
      source: {
        type: 'string', enum: ['signalKPath', 'configuration'], default: 'signalKPath',
        enumNames: ['Signal K path', 'Fixed plugin setting'],
        title: 'Brightness source'
      },
      signalKPath: {
        type: 'string', minLength: 1,
        default: 'electrical.switches.seatalkDisplayLights.dimmingLevel',
        title: 'Signal K brightness path',
        description: 'Used only when the brightness source is Signal K path.'
      },
      valueFormat: {
        type: 'string', enum: ['auto', 'ratio', 'percent', 'level'], default: 'auto',
        enumNames: ['Automatic', 'Ratio (0–1)', 'Percentage (0–100)', 'SeaTalk level (0–3)'],
        title: 'Source value format',
        description: 'Used only for Signal K path values.'
      },
      configuredLevel: {
        type: 'integer', minimum: 0, maximum: 3, default: 3,
        title: 'Fixed SeaTalk lamp level',
        description: 'Used only when the brightness source is Fixed plugin setting.'
      },
      sendOnStartup: {
        type: 'boolean', default: true,
        title: 'Send current light level at startup'
      },
      resendOnChange: {
        type: 'boolean', default: true,
        title: 'Send changes from the Signal K path',
        description: 'Has no effect when using a fixed plugin setting.'
      },
      minimumIntervalMs: {
        type: 'integer', minimum: 0, default: 250,
        title: 'Minimum lighting-command interval',
        description: 'Minimum time between 0x30 broadcasts, in milliseconds. Duplicate levels are always suppressed.'
      },
      invert: {
        type: 'boolean', default: false,
        title: 'Invert brightness mapping',
        description: 'Maps the lowest source value to L3 and the highest to L0.'
      }
    }
  }

  plugin.schema.propertyOrder.push('navigationToWaypoint', 'instrumentUnits', 'instrumentLights', 'calibrationAdvisor')
}
function sentenceBytes(sentence) {
  const body = String(sentence).trim().split('*')[0]
  return body.split(',').slice(1).map(value => value.toUpperCase())
}

const getThrottleProperty = key => `${key}_throttle`


function configurationSummary(options, datagrams) {
  const direct = Object.keys(datagrams).filter(key => !datagrams[key].managed).map(key => ({
    datagram: key,
    title: datagrams[key].title,
    enabled: options[key] === true,
    minimumIntervalMs: Number.isInteger(options[getThrottleProperty(key)]) ? options[getThrottleProperty(key)] : 0
  }))
  return {
    direct,
    navigationToWaypoint: {
      enabled: options.navigationToWaypoint?.enabled === true,
      updateIntervalMs: options.navigationToWaypoint?.updateIntervalMs ?? 1000,
      maximumAgeMs: options.navigationToWaypoint?.maximumAgeMs ?? 5000,
      calculationSkewMs: options.navigationToWaypoint?.calculationSkewMs ?? 1000,
      bearingReference: options.navigationToWaypoint?.bearingReference ?? 'magnetic',
      sendInvalidOnClear: false,
      sendWaypointNameOnClear: options.navigationToWaypoint?.sendWaypointNameOnClear === true
    },
    instrumentUnits: {
      enabled: options.instrumentUnits?.enabled === true,
      source: options.instrumentUnits?.source ?? 'signalKPreferences',
      speedAndDistance: options.instrumentUnits?.speedAndDistance ?? 'nautical',
      sendOnStartup: options.instrumentUnits?.sendOnStartup !== false,
      resendOnChange: options.instrumentUnits?.resendOnChange !== false,
      pollIntervalMs: options.instrumentUnits?.pollIntervalMs ?? 5000,
      periodicRefreshSeconds: options.instrumentUnits?.periodicRefreshSeconds ?? 0
    },
    calibrationAdvisor: {
      enabled: options.calibrationAdvisor?.enabled === true,
      measuredPath: options.calibrationAdvisor?.measuredPath ?? 'navigation.speedThroughWater',
      referencePath: options.calibrationAdvisor?.referencePath ?? 'navigation.speedOverGround',
      currentCalibrationFactor: options.calibrationAdvisor?.currentCalibrationFactor ?? 1,
      minimumSpeedMps: options.calibrationAdvisor?.minimumSpeedMps ?? 1.5,
      minimumSamples: options.calibrationAdvisor?.minimumSamples ?? 30,
      windowSize: options.calibrationAdvisor?.windowSize ?? 120,
      maximumRelativeSpread: options.calibrationAdvisor?.maximumRelativeSpread ?? 0.08,
      headingEnabled: options.calibrationAdvisor?.headingEnabled !== false,
      headingMeasuredPath: options.calibrationAdvisor?.headingMeasuredPath ?? 'navigation.headingMagnetic',
      headingReferencePath: options.calibrationAdvisor?.headingReferencePath ?? 'navigation.courseOverGroundTrue',
      headingVariationPath: options.calibrationAdvisor?.headingVariationPath ?? 'navigation.magneticVariation',
      headingSpeedPath: options.calibrationAdvisor?.headingSpeedPath ?? 'navigation.speedOverGround',
      currentHeadingOffsetDegrees: options.calibrationAdvisor?.currentHeadingOffsetDegrees ?? 0,
      headingMinimumSpeedMps: options.calibrationAdvisor?.headingMinimumSpeedMps ?? 2,
      headingMinimumSamples: options.calibrationAdvisor?.headingMinimumSamples ?? 30,
      headingWindowSize: options.calibrationAdvisor?.headingWindowSize ?? 120,
      headingMaximumSpreadDegrees: options.calibrationAdvisor?.headingMaximumSpreadDegrees ?? 5
    },
    instrumentLights: {
      enabled: options.instrumentLights?.enabled === true,
      source: options.instrumentLights?.source ?? 'signalKPath',
      signalKPath: options.instrumentLights?.signalKPath ?? 'electrical.switches.seatalkDisplayLights.dimmingLevel',
      valueFormat: options.instrumentLights?.valueFormat ?? 'auto',
      configuredLevel: options.instrumentLights?.configuredLevel ?? 3,
      sendOnStartup: options.instrumentLights?.sendOnStartup !== false,
      resendOnChange: options.instrumentLights?.resendOnChange !== false,
      minimumIntervalMs: options.instrumentLights?.minimumIntervalMs ?? 250,
      invert: options.instrumentLights?.invert === true
    }
  }
}

function validateCurrentConfiguration(options, schema) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Plugin configuration must be an object')
  if (options.navigationToWaypoint?.sendInvalidOnClear === true) {
    throw new Error('navigationToWaypoint.sendInvalidOnClear must be false because partial 0x85 frames cause SeaTalk data errors')
  }
  validateSchemaValue(options, schema, 'configuration')
  if (options.instrumentUnits?.source === 'configuration' && options.instrumentUnits?.speedAndDistance === undefined) {
    throw new Error('instrumentUnits.speedAndDistance is required when source is configuration')
  }
  const calibration = options.calibrationAdvisor
  if ((calibration?.minimumSamples ?? 30) > (calibration?.windowSize ?? 120)) {
    throw new Error('calibrationAdvisor.minimumSamples must not exceed windowSize')
  }
  if ((calibration?.headingMinimumSamples ?? 30) > (calibration?.headingWindowSize ?? 120)) {
    throw new Error('calibrationAdvisor.headingMinimumSamples must not exceed headingWindowSize')
  }
}

function validateSchemaValue(value, definition, label) {
  if (definition.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
    const properties = definition.properties || {}
    if (definition.additionalProperties === false) {
      const unknown = Object.keys(value).filter(key => !Object.hasOwn(properties, key))
      if (unknown.length) throw new Error(`Unsupported ${label} properties: ${unknown.join(', ')}`)
    }
    for (const [key, child] of Object.entries(properties)) {
      if (value[key] !== undefined) validateSchemaValue(value[key], child, label === 'configuration' ? key : `${label}.${key}`)
    }
    return
  }
  if (definition.type === 'boolean' && typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean`)
  if (definition.type === 'string') {
    if (typeof value !== 'string') throw new TypeError(`${label} must be a string`)
    if (definition.minLength !== undefined && value.length < definition.minLength) throw new RangeError(`${label} must contain at least ${definition.minLength} character(s)`)
    if (definition.maxLength !== undefined && value.length > definition.maxLength) throw new RangeError(`${label} must contain at most ${definition.maxLength} character(s)`)
  }
  if (definition.type === 'number' && !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`)
  if (definition.type === 'integer' && !Number.isInteger(value)) throw new TypeError(`${label} must be an integer`)
  if (definition.enum && !definition.enum.includes(value)) throw new RangeError(`${label} must be one of: ${definition.enum.join(', ')}`)
  if (definition.minimum !== undefined && value < definition.minimum) throw new RangeError(`${label} must be at least ${definition.minimum}`)
  if (definition.maximum !== undefined && value > definition.maximum) throw new RangeError(`${label} must be at most ${definition.maximum}`)
  if (definition.exclusiveMinimum !== undefined && value <= definition.exclusiveMinimum) throw new RangeError(`${label} must be greater than ${definition.exclusiveMinimum}`)
}

module.exports.configurationSummary = configurationSummary
module.exports.validateCurrentConfiguration = validateCurrentConfiguration
