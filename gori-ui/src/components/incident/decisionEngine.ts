import type {
  ExposureTargetType,
  MockIncident,
  WindDirection,
} from './mockIncidents'

export type DecisionTarget = {
  id: string
  name: string
  type: ExposureTargetType
  latitude: number
  longitude: number
  distanceKm: number
  horizon: '+15 min' | '+30 min'
  priority: 'Immediate' | 'Priority' | 'Monitor'
}

export type GeneratedDecision = {
  spreadDirection: WindDirection
  spreadDirectionLabel: string
  windSpeedKmh: number
  windSupport: string
  plus15ReachKm: number
  plus30ReachKm: number
  corridorHalfAngleDeg: number
  recommendedAction: string
  summary: string
  rationale: string
  timeHorizons: string[]
  exposureConfidence: string | null
  operationalPriority: 'monitor' | 'prepare' | 'act'
  reasoning: string[]
  topTarget: DecisionTarget | null
  targets: DecisionTarget[]
}

const EARTH_RADIUS_KM = 6371

const directionBearing: Record<WindDirection, number> = {
  north: 0,
  'north-east': 45,
  east: 90,
  'south-east': 135,
  south: 180,
  'south-west': 225,
  west: 270,
  'north-west': 315,
}

const directionLabel: Record<WindDirection, string> = {
  north: 'North',
  'north-east': 'North-east',
  east: 'East',
  'south-east': 'South-east',
  south: 'South',
  'south-west': 'South-west',
  west: 'West',
  'north-west': 'North-west',
}

const typeWeight: Record<ExposureTargetType, number> = {
  settlement: 1,
  utility: 0.82,
  farm: 0.66,
  road: 0.52,
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function normalizeAngle(value: number) {
  let normalized = value
  while (normalized < -180) {
    normalized += 360
  }
  while (normalized > 180) {
    normalized -= 360
  }
  return normalized
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const latDelta = toRadians(latitudeB - latitudeA)
  const lonDelta = toRadians(longitudeB - longitudeA)
  const startLat = toRadians(latitudeA)
  const endLat = toRadians(latitudeB)

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function bearingBetweenPoints(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const latA = toRadians(latitudeA)
  const latB = toRadians(latitudeB)
  const deltaLon = toRadians(longitudeB - longitudeA)
  const y = Math.sin(deltaLon) * Math.cos(latB)
  const x =
    Math.cos(latA) * Math.sin(latB) -
    Math.sin(latA) * Math.cos(latB) * Math.cos(deltaLon)

  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function spreadPressureBoost(spreadPressure: MockIncident['spreadPressure']) {
  switch (spreadPressure) {
    case 'high':
      return 1.45
    case 'elevated':
      return 1.22
    case 'moderate':
      return 1
    case 'low':
    default:
      return 0.82
  }
}

function windSupportLabel(windSpeedKmh: number) {
  if (windSpeedKmh >= 26) {
    return 'Strong wind support'
  }
  if (windSpeedKmh >= 18) {
    return 'Moderate wind support'
  }
  return 'Limited wind support'
}

function buildTargets(incident: MockIncident): DecisionTarget[] {
  const forwardBearing = directionBearing[incident.windDirection]
  const plus15ReachKm = clamp(
    (2.8 + incident.windSpeedKmh * 0.08) * spreadPressureBoost(incident.spreadPressure),
    2.2,
    7.2,
  )
  const plus30ReachKm = clamp(plus15ReachKm * 1.72, 4, 12.5)
  const corridorHalfAngleDeg = incident.spreadPressure === 'high' ? 32 : incident.spreadPressure === 'elevated' ? 28 : 24

  const scoredTargets = incident.exposureTargets
    .map((target) => {
      const distanceKm = haversineDistanceKm(
        incident.latitude,
        incident.longitude,
        target.latitude,
        target.longitude,
      )
      const targetBearing = bearingBetweenPoints(
        incident.latitude,
        incident.longitude,
        target.latitude,
        target.longitude,
      )
      const angularDelta = Math.abs(normalizeAngle(targetBearing - forwardBearing))

      if (angularDelta > corridorHalfAngleDeg || distanceKm > plus30ReachKm) {
        return null
      }

      const horizon: DecisionTarget['horizon'] =
        distanceKm <= plus15ReachKm && angularDelta <= corridorHalfAngleDeg - 4
          ? '+15 min'
          : '+30 min'

      const distanceScore = clamp(1 - distanceKm / plus30ReachKm, 0, 1)
      const alignmentScore = clamp(1 - angularDelta / corridorHalfAngleDeg, 0, 1)
      const horizonScore = horizon === '+15 min' ? 1 : 0.66
      const score =
        horizonScore * 0.48 + typeWeight[target.type] * 0.32 + distanceScore * 0.12 + alignmentScore * 0.08

      const priority: DecisionTarget['priority'] =
        horizon === '+15 min'
          ? target.type === 'settlement' || target.type === 'utility'
            ? 'Immediate'
            : 'Priority'
          : target.type === 'settlement'
            ? 'Priority'
            : 'Monitor'

      return {
        ...target,
        distanceKm,
        horizon,
        priority,
        score,
      }
    })
    .filter(Boolean) as Array<DecisionTarget & { score: number }>

  return scoredTargets
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.distanceKm - right.distanceKm
    })
    .map(({ score: _score, ...target }) => target)
}

function buildOperationalPriority(
  spreadPressure: MockIncident['spreadPressure'],
  topTarget: DecisionTarget | null,
): GeneratedDecision['operationalPriority'] {
  if (spreadPressure === 'high') {
    return 'act'
  }
  if (spreadPressure === 'elevated' || (spreadPressure === 'moderate' && topTarget)) {
    return 'prepare'
  }
  return 'monitor'
}

function buildReasoning(
  incident: MockIncident,
  topTarget: DecisionTarget | null,
): string[] {
  const reasons = ['wind_supports_spread']

  if (incident.spreadPressure === 'high' || incident.spreadPressure === 'elevated') {
    reasons.push('fire_intensity_elevated')
  }

  if (incident.terrainSummary.toLowerCase().includes('slope')) {
    reasons.push('terrain_supports_spread')
  }

  if (topTarget) {
    reasons.push(topTarget.horizon === '+15 min' ? 'near_term_target_exposed' : 'corridor_target_exposed')
  }

  return reasons.slice(0, 4)
}

export function generateDecision(incident: MockIncident): GeneratedDecision {
  const targets = buildTargets(incident)
  const topTarget = targets[0] ?? null
  const plus15ReachKm = clamp(
    (2.8 + incident.windSpeedKmh * 0.08) * spreadPressureBoost(incident.spreadPressure),
    2.2,
    7.2,
  )
  const plus30ReachKm = clamp(plus15ReachKm * 1.72, 4, 12.5)
  const corridorHalfAngleDeg = incident.spreadPressure === 'high' ? 32 : incident.spreadPressure === 'elevated' ? 28 : 24
  const spreadDirectionLabel = directionLabel[incident.windDirection]
  const windSupport = windSupportLabel(incident.windSpeedKmh)
  const operationalPriority = buildOperationalPriority(incident.spreadPressure, topTarget)
  const reasoning = buildReasoning(incident, topTarget)

  const recommendedAction = topTarget
    ? topTarget.priority === 'Immediate'
      ? `Protect ${topTarget.name} first. Prepare immediate evacuation messaging and corridor control.`
      : `Prioritize monitoring and access control around ${topTarget.name}.`
    : `Keep crews aligned to the ${spreadDirectionLabel.toLowerCase()} corridor and monitor for spotting.`

  const summary = topTarget
    ? `Likely spread is ${spreadDirectionLabel.toLowerCase()} with ${windSupport.toLowerCase()}. ${topTarget.name} is the first target inside the forecast corridor.`
    : `Likely spread is ${spreadDirectionLabel.toLowerCase()} with ${windSupport.toLowerCase()}. No mapped target is inside the short forecast corridor.`

  const rationale = topTarget
    ? `${topTarget.name} falls inside the ${topTarget.horizon} corridor at ${topTarget.distanceKm.toFixed(1)} km.`
    : `The current forecast corridor stays clear of mapped settlements and roads in the next 30 minutes.`

  return {
    spreadDirection: incident.windDirection,
    spreadDirectionLabel,
    windSpeedKmh: incident.windSpeedKmh,
    windSupport,
    plus15ReachKm,
    plus30ReachKm,
    corridorHalfAngleDeg,
    recommendedAction,
    summary,
    rationale,
    timeHorizons: ['+15', '+30'],
    exposureConfidence: 'available',
    operationalPriority,
    reasoning,
    topTarget,
    targets,
  }
}
