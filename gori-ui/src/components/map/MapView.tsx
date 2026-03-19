import { useEffect, useRef } from 'react'
import maplibregl, { Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { MockIncident } from '../incident/mockIncidents'

type MapViewProps = {
  incidents: MockIncident[]
  selectedIncidentId: string | null
  onSelectIncident: (incidentId: string) => void
}

type MarkerRegistryEntry = {
  marker: Marker
  element: HTMLDivElement
}

const severityMarkerClasses: Record<MockIncident['severityLevel'], string> = {
  critical: 'map-marker--critical',
  major: 'map-marker--major',
  minor: 'map-marker--minor',
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

function MapView({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRegistryRef = useRef<Map<string, MarkerRegistryEntry>>(new Map())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [25, 42],
      zoom: 5,
      style: {
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
      },
    })

    map.addControl(new NavigationControl(), 'top-right')
    mapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      markerRegistryRef.current.forEach(({ marker }) => marker.remove())
      markerRegistryRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

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

  return (
    <section className="flex min-h-[480px] flex-col rounded-2xl border border-border bg-panel">
      <div className="border-b border-border px-4 py-4">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-[0.16em] text-ink">
          Map View
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Prototype geospatial monitoring surface
        </p>
      </div>

      <div className="flex-1 p-3">
        <div className="h-full min-h-[400px] overflow-hidden rounded-xl border border-border">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </section>
  )
}

export default MapView
