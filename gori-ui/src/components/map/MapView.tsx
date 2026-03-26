import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, {
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { GeneratedDecision } from '../incident/decisionEngine'
import type { MockIncident, WindDirection } from '../incident/mockIncidents'

type MapViewProps = {
  incidents: MockIncident[]
  selectedIncidentId: string | null
  decision: GeneratedDecision | null
  onSelectIncident: (incidentId: string) => void
}

type MarkerRegistryEntry = {
  marker: Marker
  element: HTMLDivElement
}

type MapMode = 'map' | 'satellite'

type LngLat = {
  latitude: number
  longitude: number
}

const severityMarkerClasses: Record<MockIncident['severityLevel'], string> = {
  critical: 'map-marker--critical',
  major: 'map-marker--major',
  minor: 'map-marker--minor',
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

function buildStyle(mode: MapMode): StyleSpecification {
  if (mode === 'satellite') {
    return {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
        labels: {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri',
        },
      },
      layers: [
        {
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
        },
        {
          id: 'labels',
          type: 'raster',
          source: 'labels',
        },
      ],
    }
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-raster',
        type: 'raster',
        source: 'osm',
      },
    ],
  }
}

function buildPopupContent(incident: MockIncident) {
  return `
    <div class="map-popup">
      <p class="map-popup__zone">${incident.zoneLabel}</p>
      <p class="map-popup__meta">Severity: ${incident.severityLevel}</p>
      <p class="map-popup__meta">${incident.canonicalId}</p>
    </div>
  `
}

function applyMarkerState(
  element: HTMLDivElement,
  severityLevel: MockIncident['severityLevel'],
  isSelected: boolean,
) {
  element.className = `map-marker ${severityMarkerClasses[severityLevel]}${
    isSelected ? ' map-marker--selected' : ''
  }`
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

function buildCorridorPolygon(
  origin: LngLat,
  bearingDeg: number,
  reachKm: number,
  startWidthKm: number,
  endWidthKm: number,
  rearReachKm: number,
) {
  const forwardStations = [0.18, 0.42, 0.72, 1]
  const leftSide = forwardStations.map((progress) =>
    offsetPoint(
      origin,
      bearingDeg,
      reachKm * progress,
      (startWidthKm + (endWidthKm - startWidthKm) * progress) / 2,
    ),
  )
  const rightSide = [...forwardStations]
    .reverse()
    .map((progress) =>
      offsetPoint(
        origin,
        bearingDeg,
        reachKm * progress,
        -(startWidthKm + (endWidthKm - startWidthKm) * progress) / 2,
      ),
    )

  return [
    offsetPoint(origin, bearingDeg, rearReachKm, startWidthKm * 0.2),
    ...leftSide,
    offsetPoint(origin, bearingDeg, reachKm, 0),
    ...rightSide,
    offsetPoint(origin, bearingDeg, rearReachKm, -startWidthKm * 0.2),
  ]
}

function buildArrowHead(origin: LngLat, bearingDeg: number, reachKm: number) {
  const tip = destinationPoint(origin, reachKm, bearingDeg)
  const left = offsetPoint(origin, bearingDeg, reachKm * 0.9, 0.32)
  const right = offsetPoint(origin, bearingDeg, reachKm * 0.9, -0.32)
  return [tip, left, right]
}

function buildPath(
  map: maplibregl.Map | null,
  points: LngLat[],
  closePath: boolean,
) {
  if (!map || points.length === 0) {
    return ''
  }

  const path = points
    .map((point, index) => {
      const projected = map.project([point.longitude, point.latitude])
      return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`
    })
    .join(' ')

  return closePath ? `${path} Z` : path
}

function MapView({
  incidents,
  selectedIncidentId,
  decision,
  onSelectIncident,
}: MapViewProps) {
  const [mapMode, setMapMode] = useState<MapMode>('satellite')
  const [viewportVersion, setViewportVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRegistryRef = useRef<Map<string, MarkerRegistryEntry>>(new Map())

  const selectedIncident =
    incidents.find((incident) => incident.canonicalId === selectedIncidentId) ?? null

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [25, 42],
      zoom: 5,
      style: buildStyle(mapMode),
    })

    map.addControl(new NavigationControl(), 'top-right')
    mapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
      setViewportVersion((current) => current + 1)
    })

    resizeObserver.observe(containerRef.current)

    const syncViewport = () => setViewportVersion((current) => current + 1)
    map.on('move', syncViewport)
    map.on('zoom', syncViewport)

    return () => {
      resizeObserver.disconnect()
      map.off('move', syncViewport)
      map.off('zoom', syncViewport)
      markerRegistryRef.current.forEach(({ marker }) => marker.remove())
      markerRegistryRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    mapRef.current.setStyle(buildStyle(mapMode))
  }, [mapMode])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !selectedIncident) {
      return
    }

    map.easeTo({
      center: [selectedIncident.longitude, selectedIncident.latitude],
      zoom: Math.max(map.getZoom(), 8.4),
      duration: 850,
    })
  }, [selectedIncident])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    markerRegistryRef.current.forEach(({ marker }) => marker.remove())
    markerRegistryRef.current.clear()

    incidents.forEach((incident) => {
      const element = document.createElement('div')
      applyMarkerState(
        element,
        incident.severityLevel,
        incident.canonicalId === selectedIncidentId,
      )

      const popup = new Popup({
        closeButton: false,
        offset: 18,
      }).setHTML(buildPopupContent(incident))

      const marker = new Marker({ element })
        .setLngLat([incident.longitude, incident.latitude])
        .setPopup(popup)
        .addTo(map)

      element.addEventListener('click', () => {
        onSelectIncident(incident.canonicalId)
      })

      markerRegistryRef.current.set(incident.canonicalId, { marker, element })
    })
  }, [incidents, onSelectIncident, selectedIncidentId])

  useEffect(() => {
    markerRegistryRef.current.forEach(({ element }, incidentId) => {
      const incident = incidents.find((item) => item.canonicalId === incidentId)

      if (!incident) {
        return
      }

      applyMarkerState(
        element,
        incident.severityLevel,
        incidentId === selectedIncidentId,
      )
    })
  }, [incidents, selectedIncidentId])

  const overlayGeometry = useMemo(() => {
    const map = mapRef.current

    if (!map || !selectedIncident || !decision) {
      return null
    }

    const origin = {
      latitude: selectedIncident.latitude,
      longitude: selectedIncident.longitude,
    }
    const bearing = directionBearing[decision.spreadDirection]
    const plus15Polygon = buildCorridorPolygon(origin, bearing, decision.plus15ReachKm, 0.45, 1.55, 0.18)
    const plus30Polygon = buildCorridorPolygon(origin, bearing, decision.plus30ReachKm, 0.5, 2.2, 0.24)
    const lineEnd = destinationPoint(origin, decision.plus30ReachKm * 0.96, bearing)
    const arrowHead = buildArrowHead(origin, bearing, decision.plus30ReachKm)
    const centerPoint = map.project([origin.longitude, origin.latitude])
    const lineEndPoint = map.project([lineEnd.longitude, lineEnd.latitude])

    return {
      plus15Path: buildPath(map, plus15Polygon, true),
      plus30Path: buildPath(map, plus30Polygon, true),
      linePath: buildPath(map, [origin, lineEnd], false),
      arrowPath: buildPath(map, arrowHead, true),
      centerPoint,
      lineEndPoint,
      targetMarkers: decision.targets.slice(0, 5).map((target) => {
        const projected = map.project([target.longitude, target.latitude])
        return {
          ...target,
          x: projected.x,
          y: projected.y,
        }
      }),
    }
  }, [decision, selectedIncident, viewportVersion])

  return (
    <section className="relative min-h-[480px] overflow-hidden border border-border bg-panel">
      <div ref={containerRef} className="h-full min-h-[480px] w-full" />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-3 top-3 w-[250px] border border-border bg-[#0d131a]/92 p-2.5 backdrop-blur-sm">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent">
            Live Incident Focus
          </p>
          {selectedIncident ? (
            <>
              <h2 className="mt-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
                {selectedIncident.zoneLabel}
              </h2>
              <div className="mt-2 space-y-1 text-[10px] text-slate-300">
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    Severity
                  </span>
                  <span>{selectedIncident.severityLevel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    Wind
                  </span>
                  <span>
                    {selectedIncident.windDirection} · {selectedIncident.windSpeedKmh} km/h
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    Status
                  </span>
                  <span>{selectedIncident.status}</span>
                </div>
              </div>
              {decision ? (
                <div className="mt-3 border border-accent/20 bg-accent/10 p-2 text-[10px] leading-5 text-orange-50">
                  <div className="font-medium uppercase tracking-[0.16em] text-orange-100">
                    Forecast
                  </div>
                  <div className="mt-1">
                    Fire spread is likely toward the {decision.spreadDirectionLabel.toLowerCase()}.
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[10px] text-slate-400">
                  Select the incident and generate a decision to see wind-driven spread.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[10px] text-slate-400">No incident selected.</p>
          )}
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
          <div className="overflow-hidden border border-border bg-[#0d131a]/92 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMapMode('map')}
              className={`px-2 py-1 text-[9px] font-medium uppercase tracking-[0.2em] ${
                mapMode === 'map'
                  ? 'bg-accent/10 text-orange-100'
                  : 'text-slate-400'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapMode('satellite')}
              className={`border-l border-border px-2 py-1 text-[9px] font-medium uppercase tracking-[0.2em] ${
                mapMode === 'satellite'
                  ? 'bg-accent/10 text-orange-100'
                  : 'text-slate-400'
              }`}
            >
              Satellite
            </button>
          </div>
        </div>
      </div>

      {overlayGeometry ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <path
            d={overlayGeometry.plus30Path}
            fill="rgba(255, 188, 120, 0.14)"
            stroke="rgba(255, 223, 197, 0.35)"
            strokeWidth="1.3"
          />
          <path
            d={overlayGeometry.plus15Path}
            fill="rgba(255, 107, 61, 0.22)"
            stroke="rgba(255, 226, 212, 0.55)"
            strokeWidth="1.6"
          />
          <path
            d={overlayGeometry.linePath}
            stroke="rgba(11, 15, 20, 0.44)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={overlayGeometry.linePath}
            stroke="rgba(255, 242, 234, 0.72)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle r="2.4" fill="rgba(255, 244, 236, 0.34)">
            <animateMotion
              dur="8s"
              repeatCount="indefinite"
              path={overlayGeometry.linePath}
            />
            <animate
              attributeName="opacity"
              values="0;0.38;0"
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
          <path
            d={overlayGeometry.arrowPath}
            fill="rgba(255, 122, 79, 0.42)"
            stroke="rgba(255, 240, 232, 0.52)"
            strokeWidth="1"
          />
          <circle
            cx={overlayGeometry.centerPoint.x}
            cy={overlayGeometry.centerPoint.y}
            r="18"
            fill="rgba(255, 107, 61, 0.12)"
            stroke="rgba(255, 217, 198, 0.92)"
            strokeWidth="2.6"
          />
          <circle
            cx={overlayGeometry.centerPoint.x}
            cy={overlayGeometry.centerPoint.y}
            r="4.5"
            fill="rgba(255, 244, 236, 0.98)"
            stroke="rgba(255, 107, 61, 0.86)"
            strokeWidth="1.6"
          />
          {overlayGeometry.targetMarkers.map((target, index) => (
            <g key={target.id} transform={`translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})`}>
              <circle
                r={index === 0 ? '6.6' : '5.2'}
                fill={target.horizon === '+15 min' ? 'rgba(255, 107, 61, 0.28)' : 'rgba(255, 209, 102, 0.22)'}
                stroke={target.horizon === '+15 min' ? 'rgba(255, 231, 220, 0.85)' : 'rgba(255, 236, 189, 0.75)'}
                strokeWidth={index === 0 ? '1.5' : '1.2'}
              />
              <text
                x="9"
                y={index === 0 ? '-8' : '-6'}
                fontSize={index === 0 ? '10.5' : '10'}
                fontWeight={index === 0 ? '700' : '600'}
                fill="rgba(255, 245, 239, 0.96)"
              >
                {target.name}
              </text>
            </g>
          ))}
        </svg>
      ) : null}
    </section>
  )
}

export default MapView
