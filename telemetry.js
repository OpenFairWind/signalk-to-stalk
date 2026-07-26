'use strict'

module.exports = function createTelemetry(options = {}) {
  const capacity = Number.isInteger(options.capacity) && options.capacity > 0 ? options.capacity : 500
  const events = []
  const clients = new Set()
  const startedAt = new Date().toISOString()
  const counters = { emitted: 0, suppressed: 0, errors: 0 }
  const perDatagram = {}
  const lastDatagrams = {}
  let running = false
  let status = 'Stopped'
  let navigation = {}
  let units = {}
  let lights = {}
  let calibration = {}
  let configuration = {}

  function record(event) {
    const item = { time: new Date().toISOString(), ...event }
    events.push(item)
    if (events.length > capacity) events.splice(0, events.length - capacity)
    if (item.type === 'emitted') {
      counters.emitted += 1
      perDatagram[item.datagram] = (perDatagram[item.datagram] || 0) + 1
      lastDatagrams[item.datagram] = {
        time: item.time,
        sentence: item.sentence,
        bytes: Array.isArray(item.bytes) ? [...item.bytes] : []
      }
    } else if (item.type === 'suppressed') counters.suppressed += 1
    else if (item.type === 'error') counters.errors += 1
    const payload = `data: ${JSON.stringify(item)}\n\n`
    for (const client of clients) {
      try { client.write(payload) } catch (_) { clients.delete(client) }
    }
    return item
  }

  function snapshot() {
    return {
      running,
      status,
      startedAt,
      now: new Date().toISOString(),
      outputEvent: 'stalkout',
      totals: { ...counters },
      perDatagram: { ...perDatagram },
      lastDatagrams: structuredCloneSafe(lastDatagrams),
      navigation: { ...navigation },
      units: { ...units },
      lights: { ...lights },
      calibration: { ...calibration },
      configuration: structuredCloneSafe(configuration),
      recentCount: events.length,
      capacity
    }
  }

  function attachSse(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write(`data: ${JSON.stringify({ type: 'snapshot', ...snapshot() })}\n\n`)
    clients.add(res)
    const close = () => clients.delete(res)
    req.on('close', close)
    req.on('end', close)
  }

  return {
    record,
    snapshot,
    recent(limit = 100) {
      const count = Math.max(1, Math.min(capacity, Number(limit) || 100))
      return events.slice(-count)
    },
    attachSse,
    setRunning(value, text) { running = Boolean(value); if (text) status = text },
    setNavigation(value) { navigation = value || {} },
    setUnits(value) { units = value || {} },
    setLights(value) { lights = value || {} },
    setCalibration(value) { calibration = value || {} },
    setConfiguration(value) { configuration = structuredCloneSafe(value || {}) },
    stop() {
      running = false
      status = 'Stopped'
      for (const client of clients) {
        try { client.end() } catch (_) {}
      }
      clients.clear()
    }
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value))
}
