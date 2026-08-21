'use strict'
const Bacon = require('baconjs')

module.exports = function createCalibrationManager(app, options = {}, telemetry) {
  const config = {
    measuredPath: 'navigation.speedThroughWater',
    referencePath: 'navigation.speedOverGround',
    currentCalibrationFactor: 1,
    minimumSpeedMps: 1.5,
    minimumSamples: 30,
    windowSize: 120,
    maximumRelativeSpread: 0.08,
    ...options
  }
  const unsubscribes = []
  const samples = []
  const headingSamples = []

  function start() {
    const measured = app.streambundle.getSelfStream(config.measuredPath)
    const reference = app.streambundle.getSelfStream(config.referencePath)
    const stream = Bacon.combineWith((stw, sog) => ({ stw, sog }), [measured, reference])
      .filter(({ stw, sog }) => Number.isFinite(stw) && Number.isFinite(sog))
      .changes()
      .debounceImmediate(200)
    unsubscribes.push(stream.onValue(addSample))
    if (config.headingEnabled !== false) {
      const heading = app.streambundle.getSelfStream(config.headingMeasuredPath || 'navigation.headingMagnetic')
      const course = app.streambundle.getSelfStream(config.headingReferencePath || 'navigation.courseOverGroundTrue')
      const variation = app.streambundle.getSelfStream(config.headingVariationPath || 'navigation.magneticVariation')
      const speed = app.streambundle.getSelfStream(config.headingSpeedPath || 'navigation.speedOverGround')
      const headingStream = Bacon.combineWith((measured, reference, magneticVariation, sog) => ({ measured, reference, magneticVariation, sog }), [heading, course, variation, speed])
        .filter(({ measured, reference, magneticVariation, sog }) => [measured, reference, magneticVariation, sog].every(Number.isFinite))
        .changes()
        .debounceImmediate(200)
      unsubscribes.push(headingStream.onValue(addHeadingSample))
    }
    update('waiting')
    updateHeading('waiting')
  }

  function addHeadingSample({ measured, reference, magneticVariation = 0, sog }) {
    const minimumSpeed = config.headingMinimumSpeedMps ?? config.minimumSpeedMps
    if (sog < minimumSpeed) {
      telemetry.record({ type: 'suppressed', reason: 'heading-calibration-below-minimum-speed', values: { measured, reference, sog } })
      return updateHeading('waiting')
    }
    const referenceMagnetic = reference - magneticVariation
    const offset = normalizeRadians(referenceMagnetic - measured)
    headingSamples.push({ time: Date.now(), measured, reference: referenceMagnetic, sog, offset })
    const windowSize = config.headingWindowSize ?? config.windowSize
    if (headingSamples.length > windowSize) headingSamples.splice(0, headingSamples.length - windowSize)
    updateHeading('sampling')
  }

  function updateHeading(state) {
    const offsets = headingSamples.map(item => item.offset)
    const offset = circularMean(offsets)
    const deviations = offsets.map(value => Math.abs(normalizeRadians(value - offset))).sort((a, b) => a - b)
    const spread = median(deviations)
    const minimumSamples = config.headingMinimumSamples ?? config.minimumSamples
    const maximumSpread = (config.headingMaximumSpreadDegrees ?? 5) * Math.PI / 180
    const stable = headingSamples.length >= minimumSamples && Number.isFinite(spread) && spread <= maximumSpread
    const currentOffset = (config.currentHeadingOffsetDegrees ?? 0) * Math.PI / 180
    telemetry.setHeadingCalibration({
      enabled: config.headingEnabled !== false,
      state: stable ? 'suggestion-ready' : state,
      measuredPath: config.headingMeasuredPath || 'navigation.headingMagnetic',
      referencePath: config.headingReferencePath || 'navigation.courseOverGroundTrue',
      sampleCount: headingSamples.length,
      minimumSamples,
      currentHeadingOffsetDegrees: config.currentHeadingOffsetDegrees ?? 0,
      correctionDegrees: Number.isFinite(offset) ? offset * 180 / Math.PI : undefined,
      suggestedHeadingOffsetDegrees: Number.isFinite(offset) ? normalizeDegrees((currentOffset + offset) * 180 / Math.PI) : undefined,
      spreadDegrees: Number.isFinite(spread) ? spread * 180 / Math.PI : undefined,
      maximumSpreadDegrees: config.headingMaximumSpreadDegrees ?? 5,
      stable,
      advisory: 'Validate on several steady reciprocal headings; current, leeway, and compass deviation can bias GPS-course comparisons.'
    })
  }

  function addSample({ stw, sog }) {
    if (stw < config.minimumSpeedMps || sog < config.minimumSpeedMps) {
      telemetry.record({ type: 'suppressed', reason: 'calibration-below-minimum-speed', values: { stw, sog } })
      return update('waiting')
    }
    const ratio = sog / stw
    if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 1.5) {
      telemetry.record({ type: 'suppressed', reason: 'calibration-outlier', values: { stw, sog, ratio } })
      return
    }
    samples.push({ time: Date.now(), stw, sog, ratio })
    if (samples.length > config.windowSize) samples.splice(0, samples.length - config.windowSize)
    update('sampling')
  }

  function update(state) {
    const ratios = samples.map(item => item.ratio).sort((a, b) => a - b)
    const multiplier = median(ratios)
    const deviations = ratios.map(value => Math.abs(value - multiplier)).sort((a, b) => a - b)
    const mad = median(deviations)
    const relativeSpread = Number.isFinite(multiplier) && multiplier !== 0 ? mad / multiplier : undefined
    const enough = samples.length >= config.minimumSamples
    const stable = enough && Number.isFinite(relativeSpread) && relativeSpread <= config.maximumRelativeSpread
    telemetry.setCalibration({
      enabled: true,
      state: stable ? 'suggestion-ready' : state,
      measuredPath: config.measuredPath,
      referencePath: config.referencePath,
      currentCalibrationFactor: config.currentCalibrationFactor,
      sampleCount: samples.length,
      minimumSamples: config.minimumSamples,
      windowSize: config.windowSize,
      multiplier,
      suggestedCalibrationFactor: Number.isFinite(multiplier) ? config.currentCalibrationFactor * multiplier : undefined,
      medianMeasuredMps: median(samples.map(item => item.stw).sort((a, b) => a - b)),
      medianReferenceMps: median(samples.map(item => item.sog).sort((a, b) => a - b)),
      relativeSpread,
      stable,
      advisory: 'Use only in slack water or validate with reciprocal measured-distance runs.'
    })
  }

  function stop() {
    unsubscribes.splice(0).forEach(unsubscribe => {
      try { unsubscribe() } catch (error) { app.error(`Calibration unsubscribe failed: ${error.stack || error}`) }
    })
  }

  return { start, stop, addSample, addHeadingSample, snapshot: () => samples.slice(), headingSnapshot: () => headingSamples.slice() }
}

function normalizeRadians(value) { return ((value + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI }
function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180 }
function circularMean(values) {
  if (!values.length) return undefined
  return Math.atan2(values.reduce((sum, value) => sum + Math.sin(value), 0), values.reduce((sum, value) => sum + Math.cos(value), 0))
}

function median(values) {
  if (!values.length) return undefined
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}
module.exports.median = median
module.exports.circularMean = circularMean
