import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, {
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { t, translateSeverity } from '../../lib/translations'
import type {
  AppLanguage,
  ForecastDecisionView,
  OperatorIncidentView,
} from '../../types/gori'
import { buildSpreadOverlayGeometry } from './spreadOverlay'

type MapViewProps = {
  incidents: OperatorIncidentView[]
  selectedIncidentId: string | null
  decision: ForecastDecisionView | null
  language: AppLanguage
  focusRequest: number
  onSelectIncident: (incidentId: string) => void
}

type MarkerRegistryEntry = {
  marker: Marker
  element: HTMLDivElement
}

type MapMode = 'map' | 'satellite'

type ExecutiveTargetMarker = ForecastDecisionView['targets'][number] & {
  x: number
  y: number
  labelWidth: number
  labelOffsetX: number
  labelOffsetY: number
  align: 'left' | 'right'
}

const severityMarkerClasses: Record<OperatorIncidentView['severityLevel'], string> = {
  critical: 'map-marker--critical',
  major: 'map-marker--major',
  minor: 'map-marker--minor',
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

function buildPopupContent(incident: OperatorIncidentView, language: AppLanguage) {
  return `
    <div class="map-popup">
      <p class="map-popup__zone">${incident.zoneLabel}</p>
      <p class="map-popup__meta">${t(language, 'status')}: ${incident.status}</p>
      <p class="map-popup__meta">${translateSeverity(language, incident.severityLevel)}</p>
    </div>
  `
}

function applyMarkerState(
  element: HTMLDivElement,
  severityLevel: OperatorIncidentView['severityLevel'],
  isSelected: boolean,
) {
  element.className = `map-marker ${severityMarkerClasses[severityLevel]}${
    isSelected ? ' map-marker--selected' : ''
  }`
}

function buildExecutiveTargets(map: maplibregl.Map, decision: ForecastDecisionView) {
  const settlementTargets = decision.targets.filter((target) => target.type === 'settlement')
  const focusTargets = (settlementTargets.length > 0 ? settlementTargets : decision.targets).slice(0, 1)
  const focusTargetIds = new Set(focusTargets.map((target) => target.id))

  const executiveTargets: ExecutiveTargetMarker[] = focusTargets.map((target, index) => {
    const projected = map.project([target.longitude, target.latitude])
    const shouldLabelLeft = projected.x > map.getContainer().clientWidth * 0.58
    const labelWidth = Math.max(104, Math.min(176, 44 + target.name.length * 6.1))

    return {
      ...target,
      x: projected.x,
      y: projected.y,
      labelWidth,
      align: shouldLabelLeft ? 'left' : 'right',
      labelOffsetX: shouldLabelLeft ? -(labelWidth + 22) : 18,
      labelOffsetY: index === 0 ? -28 : 12,
    }
  })

  const supportTargets = decision.targets
    .filter((target) => !focusTargetIds.has(target.id))
    .slice(0, 3)
    .map((target) => {
      const projected = map.project([target.longitude, target.latitude])
      return {
        ...target,
        x: projected.x,
        y: projected.y,
      }
    })

  return {
    executiveTargets,
    supportTargets,
    firstSettlementName:
      settlementTargets[0]?.name ??
      (decision.targets[0]?.type === 'settlement' ? decision.targets[0].name : null),
  }
}

function MapView({
  incidents,
  selectedIncidentId,
  decision,
  language,
  focusRequest,
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

    if (!map || !selectedIncident || selectedIncident.latitude == null || selectedIncident.longitude == null) {
      return
    }

    map.easeTo({
      center: [selectedIncident.longitude, selectedIncident.latitude],
      zoom: 11.8,
      duration: 900,
    })
  }, [focusRequest, selectedIncident])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    markerRegistryRef.current.forEach(({ marker }) => marker.remove())
    markerRegistryRef.current.clear()

    incidents
      .filter((incident) => incident.latitude != null && incident.longitude != null)
      .forEach((incident) => {
        const element = document.createElement('div')
        applyMarkerState(
          element,
          incident.severityLevel,
          incident.canonicalId === selectedIncidentId,
        )

        const popup = new Popup({
          closeButton: false,
          offset: 18,
        }).setHTML(buildPopupContent(incident, language))

        const marker = new Marker({ element })
          .setLngLat([incident.longitude as number, incident.latitude as number])
          .setPopup(popup)
          .addTo(map)

        element.addEventListener('click', () => {
          onSelectIncident(incident.canonicalId)
        })

        markerRegistryRef.current.set(incident.canonicalId, { marker, element })
      })
  }, [incidents, language, onSelectIncident, selectedIncidentId])

  useEffect(() => {
    markerRegistryRef.current.forEach(({ element }, incidentId) => {
      const incident = incidents.find((item) => item.canonicalId === incidentId)

      if (!incident) {
        return
      }

      applyMarkerState(element, incident.severityLevel, incidentId === selectedIncidentId)
    })
  }, [incidents, selectedIncidentId])

  const overlayGeometry = useMemo(() => {
    const map = mapRef.current

    if (
      !map ||
      !selectedIncident ||
      !decision ||
      !decision.spreadDirection ||
      selectedIncident.latitude == null ||
      selectedIncident.longitude == null
    ) {
      return null
    }

    const origin = {
      latitude: selectedIncident.latitude,
      longitude: selectedIncident.longitude,
    }
    const spreadGeometry = buildSpreadOverlayGeometry(map, origin, decision)
    if (!spreadGeometry) {
      return null
    }
    const executiveTargets = buildExecutiveTargets(map, decision)

    return {
      ...spreadGeometry,
      ...executiveTargets,
    }
  }, [decision, language, selectedIncident, viewportVersion])

  return (
    <section className="relative h-full min-h-0 overflow-hidden border border-border bg-panel">
      <div ref={containerRef} className="h-full w-full overflow-hidden" />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-3 top-3 w-[188px] max-h-[88px] overflow-hidden border border-border/50 bg-[#0d131a]/78 p-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t(language, 'currentSituation')}
          </p>
          {selectedIncident ? (
            <>
              <h2 className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                {selectedIncident.zoneLabel}
              </h2>
              <div className="mt-1 space-y-0.5 text-[8px] leading-4 text-slate-300">
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    {t(language, 'status')}
                  </span>
                  <span>{selectedIncident.status}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    {t(language, 'confidenceLevel')}
                  </span>
                  <span>{selectedIncident.confidenceLabel}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-slate-500">
                    {t(language, 'lastUpdated')}
                  </span>
                  <span>{selectedIncident.lastUpdated}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-[9px] leading-4 text-slate-400">{t(language, 'noIncidentSelected')}</p>
          )}
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
          <div className="overflow-hidden border border-border/70 bg-[#0d131a]/88 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMapMode('map')}
              className={`px-2 py-1 text-[9px] font-medium uppercase tracking-[0.2em] ${
                mapMode === 'map' ? 'bg-accent/10 text-orange-100' : 'text-slate-400'
              }`}
            >
              {t(language, 'map')}
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
              {t(language, 'satellite')}
            </button>
          </div>
        </div>
      </div>

      {overlayGeometry ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient
              id="spread-plus30-gradient"
              gradientUnits="userSpaceOnUse"
              x1={overlayGeometry.centerPoint.x}
              y1={overlayGeometry.centerPoint.y}
              x2={overlayGeometry.tipPoint.x}
              y2={overlayGeometry.tipPoint.y}
            >
              <stop offset="0%" stopColor="rgba(255, 188, 120, 0.025)" />
              <stop offset="58%" stopColor="rgba(255, 188, 120, 0.095)" />
              <stop offset="100%" stopColor="rgba(255, 188, 120, 0.17)" />
            </linearGradient>
            <linearGradient
              id="spread-plus15-gradient"
              gradientUnits="userSpaceOnUse"
              x1={overlayGeometry.centerPoint.x}
              y1={overlayGeometry.centerPoint.y}
              x2={overlayGeometry.tipPoint.x}
              y2={overlayGeometry.tipPoint.y}
            >
              <stop offset="0%" stopColor="rgba(255, 107, 61, 0.05)" />
              <stop offset="62%" stopColor="rgba(255, 107, 61, 0.16)" />
              <stop offset="100%" stopColor="rgba(255, 107, 61, 0.255)" />
            </linearGradient>
          </defs>
          <path
            d={overlayGeometry.plus30Path}
            fill="url(#spread-plus30-gradient)"
            stroke="rgba(255, 223, 197, 0.2)"
            strokeWidth="1"
          />
          <path
            d={overlayGeometry.plus15Path}
            fill="url(#spread-plus15-gradient)"
            stroke="rgba(255, 226, 212, 0.24)"
            strokeWidth="1.1"
          />
          <path
            d={overlayGeometry.linePath}
            stroke="rgba(8, 11, 15, 0.26)"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={overlayGeometry.linePath}
            stroke="rgba(255, 242, 234, 0.84)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle r="2.2" fill="rgba(255, 244, 236, 0.18)">
            <animateMotion dur="8s" repeatCount="indefinite" path={overlayGeometry.linePath} />
            <animate
              attributeName="opacity"
              values="0;0.38;0"
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={overlayGeometry.centerPoint.x}
            cy={overlayGeometry.centerPoint.y}
            r="18"
            fill="rgba(255, 107, 61, 0.05)"
            stroke="rgba(255, 217, 198, 0.56)"
            strokeWidth="1.5"
          />
          <circle
            cx={overlayGeometry.centerPoint.x}
            cy={overlayGeometry.centerPoint.y}
            r="4.5"
            fill="rgba(255, 244, 236, 0.98)"
            stroke="rgba(255, 107, 61, 0.58)"
            strokeWidth="1"
          />
          {overlayGeometry.supportTargets.map((target) => (
            <g key={target.id} transform={`translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})`}>
              <circle
                r="4.4"
                fill={
                  target.horizon === '+15 min'
                    ? 'rgba(255, 107, 61, 0.18)'
                    : 'rgba(255, 209, 102, 0.14)'
                }
                stroke={
                  target.horizon === '+15 min'
                    ? 'rgba(255, 231, 220, 0.44)'
                    : 'rgba(255, 236, 189, 0.34)'
                }
                strokeWidth="1.1"
              />
            </g>
          ))}
          {overlayGeometry.executiveTargets.map((target, index) => (
            <g key={target.id} transform={`translate(${target.x.toFixed(1)} ${target.y.toFixed(1)})`}>
              <line
                x1="0"
                y1="0"
                x2={target.labelOffsetX + (target.align === 'right' ? 0 : target.labelWidth)}
                y2={target.labelOffsetY + 8}
                stroke={index === 0 ? 'rgba(255, 240, 232, 0.48)' : 'rgba(255, 232, 215, 0.34)'}
                strokeWidth={index === 0 ? '1.1' : '0.9'}
              />
              <circle
                r={index === 0 ? '5.4' : '4.6'}
                fill={
                  target.horizon === '+15 min'
                    ? 'rgba(255, 107, 61, 0.16)'
                    : 'rgba(255, 182, 82, 0.1)'
                }
                stroke={
                  target.horizon === '+15 min'
                    ? 'rgba(255, 238, 228, 0.38)'
                    : 'rgba(255, 235, 194, 0.28)'
                }
                strokeWidth={index === 0 ? '1.8' : '1.5'}
              />
              <rect
                x={target.labelOffsetX}
                y={target.labelOffsetY - 2}
                width={Math.min(target.labelWidth, 140)}
                height="18"
                rx="12"
                fill={index === 0 ? 'rgba(13, 19, 26, 0.62)' : 'rgba(13, 19, 26, 0.58)'}
                stroke={index === 0 ? 'rgba(255, 170, 120, 0.2)' : 'rgba(255, 205, 168, 0.12)'}
                strokeWidth="0.6"
              />
              <text
                x={target.labelOffsetX + 10}
                y={target.labelOffsetY + 8}
                fontSize="6.8"
                fontWeight="700"
                fill={
                  target.horizon === '+15 min'
                    ? 'rgba(255, 199, 172, 0.74)'
                    : 'rgba(255, 222, 190, 0.64)'
                }
              >
                {target.horizon}
              </text>
              <text
                x={target.labelOffsetX + 34}
                y={target.labelOffsetY + 8}
                fontSize={index === 0 ? '8.2' : '7.8'}
                fontWeight={index === 0 ? '600' : '500'}
                fill="rgba(255, 245, 239, 0.72)"
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
