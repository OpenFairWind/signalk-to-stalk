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
  let unsubscribe
  const samples = []

  function start() {
    const measured = app.streambundle.getSelfStream(config.measuredPath)
    const reference = app.streambundle.getSelfStream(config.referencePath)
    const stream = Bacon.combineWith((stw, sog) => ({ stw, sog }), [measured, reference])
      .filter(({ stw, sog }) => Number.isFinite(stw) && Number.isFinite(sog))
      .changes()
      .debounceImmediate(200)
    unsubscribe = stream.onValue(addSample)
    update('waiting')
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
    if (unsubscribe) unsubscribe()
    unsubscribe = undefined
  }

  return { start, stop, addSample, snapshot: () => samples.slice() }
}

function median(values) {
  if (!values.length) return undefined
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}
module.exports.median = median
