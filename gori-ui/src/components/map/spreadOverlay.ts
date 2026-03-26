import maplibregl from 'maplibre-gl'

import type { ForecastDecisionView, WindDirection } from '../../types/gori'

type LngLat = {
  latitude: number
  longitude: number
}

export type SpreadOverlayGeometry = {
  plus15Path: string
  plus30Path: string
  linePath: string
  centerPoint: { x: number; y: number }
  tipPoint: { x: number; y: number }
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function destinationPoint(origin: LngLat, distanceKm: number, bearingDeg: number): LngLat {
  const angularDistance = distanceKm / 6371
  const bearing = toRadians(bearingDeg)
  const latitude1 = toRadians(origin.latitude)
  const longitude1 = toRadians(origin.longitude)

  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
      Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  )

  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
      Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
    )

  return {
    latitude: toDegrees(latitude2),
    longitude: toDegrees(longitude2),
  }
}

function offsetPoint(origin: LngLat, bearingDeg: number, forwardKm: number, lateralKm: number) {
  const basePoint = destinationPoint(origin, forwardKm, bearingDeg)

  if (Math.abs(lateralKm) < 0.001) {
    return basePoint
  }

  return destinationPoint(
    basePoint,
    Math.abs(lateralKm),
    lateralKm >= 0 ? bearingDeg + 90 : bearingDeg - 90,
  )
}

function buildPath(map: maplibregl.Map, points: LngLat[], closePath: boolean) {
  const path = points
    .map((point, index) => {
      const projected = map.project([point.longitude, point.latitude])
      return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`
    })
    .join(' ')

  return closePath ? `${path} Z` : path
}

function buildCorridorPolygon(
  origin: LngLat,
  bearingDeg: number,
  reachKm: number,
  rearReachKm: number,
  halfAngleDeg: number,
) {
  const effectiveAngle = clamp(halfAngleDeg, 20, 35)
  const terminalHalfWidthKm = Math.tan(toRadians(effectiveAngle)) * reachKm * 0.38
  const startHalfWidthKm = clamp(terminalHalfWidthKm * 0.12, 0.16, 0.38)
  const stations = [0.08, 0.24, 0.44, 0.68, 1]

  const leftSide = stations.map((progress) =>
    offsetPoint(
      origin,
      bearingDeg,
      reachKm * progress,
      startHalfWidthKm + (terminalHalfWidthKm - startHalfWidthKm) * Math.pow(progress, 1.18),
    ),
  )
  const rightSide = [...stations]
    .reverse()
    .map((progress) =>
      offsetPoint(
        origin,
        bearingDeg,
        reachKm * progress,
        -(startHalfWidthKm +
          (terminalHalfWidthKm - startHalfWidthKm) * Math.pow(progress, 1.18)),
      ),
    )

  return [
    offsetPoint(origin, bearingDeg, rearReachKm, startHalfWidthKm * 0.12),
    ...leftSide,
    destinationPoint(origin, reachKm * 1.01, bearingDeg),
    ...rightSide,
    offsetPoint(origin, bearingDeg, rearReachKm, -startHalfWidthKm * 0.12),
  ]
}

export function buildSpreadOverlayGeometry(
  map: maplibregl.Map,
  origin: LngLat,
  decision: ForecastDecisionView,
): SpreadOverlayGeometry | null {
  if (!decision.spreadDirection) {
    return null
  }

  const bearing = directionBearing[decision.spreadDirection]
  const baseHalfAngle = clamp(decision.corridorHalfAngleDeg, 20, 35)
  const plus15Polygon = buildCorridorPolygon(
    origin,
    bearing,
    decision.plus15ReachKm,
    Math.min(0.12, decision.plus15ReachKm * 0.02),
    baseHalfAngle - 3,
  )
  const plus30Polygon = buildCorridorPolygon(
    origin,
    bearing,
    decision.plus30ReachKm,
    Math.min(0.16, decision.plus30ReachKm * 0.022),
    baseHalfAngle,
  )
  const lineEnd = destinationPoint(origin, decision.plus30ReachKm * 0.98, bearing)
  const centerPoint = map.project([origin.longitude, origin.latitude])
  const tipPoint = map.project([lineEnd.longitude, lineEnd.latitude])

  return {
    plus15Path: buildPath(map, plus15Polygon, true),
    plus30Path: buildPath(map, plus30Polygon, true),
    linePath: buildPath(map, [origin, lineEnd], false),
    centerPoint,
    tipPoint,
  }
}
