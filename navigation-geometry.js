'use strict'

const EARTH_RADIUS_METRES = 6371008.8
const TAU = 2 * Math.PI

function validatePosition(position, label = 'position') {
  if (!position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
    throw new TypeError(`${label} must contain finite latitude and longitude`)
  }
  if (position.latitude < -90 || position.latitude > 90 || position.longitude < -180 || position.longitude > 180) {
    throw new RangeError(`${label} latitude/longitude is out of range`)
  }
  return position
}

function angularDistance(from, to) {
  validatePosition(from, 'from')
  validatePosition(to, 'to')
  const lat1 = radians(from.latitude)
  const lat2 = radians(to.latitude)
  const deltaLat = lat2 - lat1
  const deltaLon = normalizeLongitudeRadians(radians(to.longitude - from.longitude))
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}

function distanceAndBearing(from, to) {
  const distance = angularDistance(from, to) * EARTH_RADIUS_METRES
  if (distance === 0) return { distance: 0, bearingTrue: 0 }
  const lat1 = radians(from.latitude)
  const lat2 = radians(to.latitude)
  const deltaLon = normalizeLongitudeRadians(radians(to.longitude - from.longitude))
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  return { distance, bearingTrue: normalizeRadians(Math.atan2(y, x)) }
}

function crossTrackError(start, destination, position) {
  const leg = angularDistance(start, destination)
  if (leg === 0) return 0
  const fromStart = angularDistance(start, position)
  const legBearing = distanceAndBearing(start, destination).bearingTrue
  const positionBearing = distanceAndBearing(start, position).bearingTrue
  // Signal K: positive is right of track, negative is left of track.
  return Math.asin(clamp(Math.sin(fromStart) * Math.sin(positionBearing - legBearing), -1, 1)) * EARTH_RADIUS_METRES
}

function calculateNavigation(position, destination, previousPosition) {
  const result = distanceAndBearing(position, destination)
  return {
    ...result,
    // A direct-to without a leg origin has no meaningful lateral error.
    crossTrackError: previousPosition ? crossTrackError(previousPosition, destination, position) : 0
  }
}

function radians(degrees) { return degrees * Math.PI / 180 }
function normalizeRadians(value) { return ((value % TAU) + TAU) % TAU }
function normalizeLongitudeRadians(value) { return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)) }

module.exports = { EARTH_RADIUS_METRES, validatePosition, distanceAndBearing, crossTrackError, calculateNavigation }
