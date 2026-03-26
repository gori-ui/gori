import { useEffect, useMemo, useState } from 'react'

import { createDemoSession } from '../components/demo/demoScenario'
import { generateDecision } from '../components/incident/decisionEngine'
import IncidentPanel from '../components/incident/IncidentPanel'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import MapView from '../components/map/MapView'
import { buildExternalComparisonLinks } from '../lib/externalComparison'
import {
  formatExposureHorizons,
  formatExposureSummary,
  translateDirection,
  translateSpreadPressure,
} from '../lib/translations'
import {
  fetchOperatorIncidentDetail,
  fetchOperatorIncidentHistory,
  fetchOperatorIncidents,
  fetchOperatorSummary,
  fetchOperatorZoneDecision,
} from '../services/goriApi'
import type {
  AppLanguage,
  AppMode,
  ForecastDecisionView,
  IncidentLifecycle,
  IncidentSeverity,
  OperatorIncidentDetailApi,
  OperatorIncidentHistoryApiItem,
  OperatorIncidentListItemApi,
  OperatorIncidentView,
  OperatorSummaryApi,
  OperatorZoneDecisionApi,
  PriorityCue,
  SpreadPressure,
  WindDirection,
} from '../types/gori'

const demoSeed = createDemoSession()

type DemoIncident = (typeof demoSeed.incidents)[number]

const directionMap: Record<string, WindDirection> = {
  north: 'north',
  'north-east': 'north-east',
  northeast: 'north-east',
  east: 'east',
  'south-east': 'south-east',
  southeast: 'south-east',
  south: 'south',
  'south-west': 'south-west',
  southwest: 'south-west',
  west: 'west',
  'north-west': 'north-west',
  northwest: 'north-west',
  'север': 'north',
  'североизток': 'north-east',
  'изток': 'east',
  'югоизток': 'south-east',
  'юг': 'south',
  'югозапад': 'south-west',
  'запад': 'west',
  'северозапад': 'north-west',
}

function normalizeSeverity(value?: string | null): IncidentSeverity {
  return value === 'critical' || value === 'major' || value === 'minor' ? value : 'minor'
}

function normalizeLifecycle(value?: string | null): IncidentLifecycle {
  return value === 'active' || value === 'stabilizing' || value === 'contained'
    ? value
    : 'active'
}

function normalizePressure(value?: string | null): SpreadPressure {
  return value === 'high' || value === 'elevated' || value === 'moderate' || value === 'low'
    ? value
    : 'low'
}

function normalizePriority(value?: string | null): PriorityCue {
  const map: Record<string, PriorityCue> = {
    immediate: 'Immediate',
    priority: 'Priority',
    monitor: 'Monitor',
    watch: 'Watch',
  }
  return map[(value ?? '').toLowerCase()] ?? 'Watch'
}

function normalizeDirection(value?: string | null): WindDirection | null {
  if (!value) {
    return null
  }
  return directionMap[value.toLowerCase()] ?? null
}

function parseWindSpeed(note?: string | null): number | null {
  if (!note) {
    return null
  }
  const match = note.match(/(\d+(?:\.\d+)?)\s*km\/h/i)
  return match ? Number(match[1]) : null
}

function formatTimestamp(value?: string | null, language: AppLanguage = 'bg') {
  if (!value) {
    return language === 'bg' ? 'няма обновяване' : 'no update'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(language === 'bg' ? 'bg-BG' : 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapTimeline(
  detail?: OperatorIncidentDetailApi,
  historyItems?: OperatorIncidentHistoryApiItem[],
  language: AppLanguage = 'bg',
) {
  const detailEntries =
    detail?.timelineSummary?.map((entry) => ({
      time: formatTimestamp(entry.timestamp, language),
      label: entry.label || (language === 'bg' ? 'Събитие от detail payload' : 'Incident event'),
    })) ?? []

  const historyEntries =
    historyItems?.flatMap(
      (item) =>
        item.timelineSummary?.map((entry) => ({
          time: formatTimestamp(entry.timestamp ?? item.lastUpdatedAt, language),
          label:
            entry.label ||
            (language === 'bg' ? 'Събитие от history payload' : 'History event'),
        })) ?? [],
    ) ?? []

  const merged = [...detailEntries, ...historyEntries]
  const seen = new Set<string>()

  return merged.filter((entry) => {
    const key = `${entry.time}-${entry.label}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function terrainSummaryFromDecision(
  decision?: OperatorZoneDecisionApi | null,
  language: AppLanguage = 'bg',
) {
  const terrain = decision?.spread?.terrainInfluence
  if (!terrain) {
    return language === 'bg'
      ? 'Теренният контекст идва от live decision payload.'
      : 'Terrain context comes from the live decision payload.'
  }

  const pieces = [terrain.slopeClass, terrain.terrainPressure].filter(Boolean)
  return pieces.length > 0
    ? pieces.join(' · ')
    : language === 'bg'
      ? 'Наличен е ограничен теренен контекст.'
      : 'Limited terrain context is available.'
}

function localContextFromDecision(
  decision?: OperatorZoneDecisionApi | null,
  language: AppLanguage = 'bg',
) {
  return (
    decision?.spread?.note ??
    decision?.routing?.note ??
    decision?.note ??
    (language === 'bg'
      ? 'Live режимът използва само backend контекст.'
      : 'Live mode uses backend context only.')
  )
}

function confidenceFromDecision(
  decision?: OperatorZoneDecisionApi | null,
  language: AppLanguage = 'bg',
) {
  const status = decision?.crossConfirmation?.status
  if (!status) {
    return language === 'bg' ? 'Няма cross-confirmation' : 'No cross-confirmation'
  }
  const map: Record<string, string> = {
    weak: language === 'bg' ? 'Слаба' : 'Weak',
    moderate: language === 'bg' ? 'Умерена' : 'Moderate',
    strong: language === 'bg' ? 'Силна' : 'Strong',
  }
  return map[status] ?? status
}

function verificationStatusFromDecision(
  detail?: OperatorIncidentDetailApi,
  decision?: OperatorZoneDecisionApi | null,
  language: AppLanguage = 'bg',
) {
  if (decision?.crossConfirmation?.note) {
    return decision.crossConfirmation.note
  }
  if ((detail?.sources?.length ?? 0) > 1) {
    return language === 'bg' ? 'Многоизточниково потвърждение' : 'Multi-source confirmation'
  }
  return language === 'bg' ? 'Ограничено потвърждение' : 'Limited confirmation'
}

function buildLiveDecisionView(
  decision: OperatorZoneDecisionApi | null | undefined,
  incident: OperatorIncidentView | null,
  language: AppLanguage,
): ForecastDecisionView | null {
  if (!decision || !incident) {
    return null
  }

  const exposure = decision.exposure
  const spreadDirection =
    normalizeDirection(exposure?.primaryDirection) ??
    normalizeDirection(decision.spread?.higherRiskDirection) ??
    normalizeDirection(decision.spread?.lowerRiskDirection)

  const spreadPressure = normalizePressure(
    exposure?.pressure ?? decision.spread?.spreadPressure ?? incident.spreadPressure,
  )

  const plus15ReachKm =
    {
      high: 5.6,
      elevated: 4.8,
      moderate: 4.1,
      low: 3.2,
    }[spreadPressure] ?? 4.1

  const plus30ReachKm = Number((plus15ReachKm * 1.58).toFixed(1))
  const corridorHalfAngleDeg =
    {
      high: 29,
      elevated: 27,
      moderate: 24,
      low: 20,
    }[spreadPressure] ?? 24

  const spreadDirectionLabel = spreadDirection
    ? translateDirection(language, spreadDirection)
    : language === 'bg'
      ? 'неуточнена'
      : 'unavailable'
  const pressureLabel = translateSpreadPressure(language, spreadPressure)
  const timeHorizons =
    exposure?.timeHorizon && exposure.timeHorizon.length > 0
      ? exposure.timeHorizon.map((value) => (value.includes('min') ? value : `${value} min`))
      : ['+15 min', '+30 min']
  const summary = spreadDirection
    ? formatExposureSummary(language, spreadDirectionLabel, pressureLabel)
    : exposure?.summary ??
      (language === 'bg'
        ? 'Няма достатъчно данни за exposure summary.'
        : 'Not enough data for an exposure summary.')
  const operationalPriority =
    exposure?.priority === 'monitor' || exposure?.priority === 'prepare' || exposure?.priority === 'act'
      ? exposure.priority
      : null
  const reasoning = Array.isArray(exposure?.reasoning)
    ? exposure.reasoning.filter((value): value is string => typeof value === 'string').slice(0, 4)
    : []

  return {
    spreadDirection,
    spreadDirectionLabel,
    windSpeedKmh: parseWindSpeed(decision.spread?.note) ?? incident.windSpeedKmh,
    windSupport:
      decision.spread?.note ??
      (language === 'bg'
        ? 'Подкрепено от текущия spread context.'
        : 'Supported by the current spread context.'),
    plus15ReachKm,
    plus30ReachKm,
    corridorHalfAngleDeg,
    recommendedAction:
      decision.note ??
      (language === 'bg'
        ? 'Следвай зоналното решение и сравни външно при нужда.'
        : 'Follow the zone decision and cross-check externally if needed.'),
    summary,
    rationale: `${formatExposureHorizons(language, timeHorizons)} ${decision.spread?.note ?? ''}`.trim(),
    timeHorizons,
    exposureConfidence: exposure?.confidence ?? decision.spread?.status ?? null,
    operationalPriority,
    reasoning,
    topTarget: null,
    targets: [],
  }
}

function buildLiveIncidentView(
  listItem: OperatorIncidentListItemApi,
  detail: OperatorIncidentDetailApi | undefined,
  historyItems: OperatorIncidentHistoryApiItem[] | undefined,
  decision: OperatorZoneDecisionApi | undefined,
  language: AppLanguage,
): OperatorIncidentView {
  return {
    canonicalId: listItem.canonicalId,
    incidentId: detail?.runtimeIncidentId || listItem.canonicalId,
    zoneId: detail?.zoneId ?? listItem.zoneId,
    zoneLabel: detail?.zoneLabel ?? listItem.zoneLabel ?? listItem.canonicalId,
    regionLabel:
      decision?.zone?.region ||
      detail?.zoneId ||
      (language === 'bg' ? 'Оперативен район' : 'Operational zone'),
    severityLevel: normalizeSeverity(detail?.severityLevel ?? listItem.severityLevel),
    lifecycleState: normalizeLifecycle(detail?.lifecycleState ?? listItem.lifecycleState),
    status:
      detail?.status ??
      listItem.status ??
      (language === 'bg' ? 'Наличен в live backend' : 'Available in live backend'),
    spreadPressure: normalizePressure(
      decision?.spread?.spreadPressure ?? listItem.spreadPressure,
    ),
    signalCount: detail?.signalsCount ?? 0,
    lastUpdated: formatTimestamp(detail?.lastUpdatedAt ?? listItem.lastUpdatedAt, language),
    priorityCue: normalizePriority(listItem.incidentPriority),
    confidenceLabel: confidenceFromDecision(decision, language),
    responseWindow: language === 'bg' ? 'live backend' : 'live backend',
    verificationStatus: verificationStatusFromDecision(detail, decision, language),
    terrainSummary: terrainSummaryFromDecision(decision, language),
    localContext: localContextFromDecision(decision, language),
    impactForecast:
      decision?.exposure?.summary ??
      decision?.spread?.note ??
      (language === 'bg'
        ? 'Няма експлицитен forecast target feed в live payload.'
        : 'No explicit forecast target feed in the live payload.'),
    resourcesAssigned: language === 'bg' ? 'Live backend context' : 'Live backend context',
    latitude: detail?.location?.latitude ?? null,
    longitude: detail?.location?.longitude ?? null,
    windDirection:
      normalizeDirection(decision?.spread?.higherRiskDirection) ??
      normalizeDirection(decision?.spread?.lowerRiskDirection),
    windSpeedKmh: parseWindSpeed(decision?.spread?.note),
    signals: detail?.sources ?? [],
    timeline: mapTimeline(detail, historyItems, language),
    exposureTargets: [],
    comparisonLinks: buildExternalComparisonLinks(
      detail?.location?.latitude ?? null,
      detail?.location?.longitude ?? null,
    ),
    modeSource: 'live',
  }
}

function buildDemoIncidentView(incident: DemoIncident): OperatorIncidentView {
  return {
    ...incident,
    zoneId: incident.zoneLabel,
    lastUpdated: incident.lastUpdated,
    comparisonLinks: buildExternalComparisonLinks(incident.latitude, incident.longitude),
    modeSource: 'demo',
    timeline: incident.timeline,
    signals: incident.signals,
  }
}

function Dashboard() {
  const [mode, setMode] = useState<AppMode>('demo')
  const [language, setLanguage] = useState<AppLanguage>('bg')
  const [demoState, setDemoState] = useState(demoSeed)

  const [liveSummary, setLiveSummary] = useState<OperatorSummaryApi | null>(null)
  const [liveList, setLiveList] = useState<OperatorIncidentListItemApi[]>([])
  const [liveDetails, setLiveDetails] = useState<Record<string, OperatorIncidentDetailApi>>({})
  const [liveHistory, setLiveHistory] = useState<Record<string, OperatorIncidentHistoryApiItem[]>>(
    {},
  )
  const [liveDecisions, setLiveDecisions] = useState<Record<string, OperatorZoneDecisionApi>>({})
  const [liveSelectedIncidentId, setLiveSelectedIncidentId] = useState<string | null>(null)
  const [mapFocusRequest, setMapFocusRequest] = useState(0)

  useEffect(() => {
    if (mode !== 'live') {
      return
    }

    let cancelled = false

    async function loadLiveDashboard() {
      const [summary, incidents] = await Promise.all([
        fetchOperatorSummary(),
        fetchOperatorIncidents(),
      ])

      if (cancelled) {
        return
      }

      setLiveSummary(summary)
      setLiveList(incidents)

      if (incidents.length === 0) {
        setLiveSelectedIncidentId(null)
        setLiveDetails({})
        setLiveHistory({})
        setLiveDecisions({})
        return
      }

      const detailEntries = await Promise.all(
        incidents.map(
          async (item) =>
            [item.canonicalId, await fetchOperatorIncidentDetail(item.canonicalId)] as const,
        ),
      )

      if (cancelled) {
        return
      }

      const detailMap = Object.fromEntries(detailEntries)
      setLiveDetails(detailMap)

      const nextSelectedId =
        incidents.find((item) => item.canonicalId === liveSelectedIncidentId)?.canonicalId ??
        incidents[0].canonicalId
      setLiveSelectedIncidentId(nextSelectedId)

      const nextDetail = detailMap[nextSelectedId]
      if (nextDetail?.zoneId) {
        const [historyItems, zoneDecision] = await Promise.all([
          fetchOperatorIncidentHistory(nextSelectedId),
          fetchOperatorZoneDecision(nextDetail.zoneId),
        ])

        if (cancelled) {
          return
        }

        setLiveHistory((current) => ({ ...current, [nextSelectedId]: historyItems }))
        setLiveDecisions((current) => ({ ...current, [nextSelectedId]: zoneDecision }))
      }
    }

    loadLiveDashboard().catch((error) => {
      console.error(error)
      if (!cancelled) {
        setLiveSummary(null)
        setLiveList([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [liveSelectedIncidentId, mode])

  const liveIncidents = useMemo(
    () =>
      liveList.map((item) =>
        buildLiveIncidentView(
          item,
          liveDetails[item.canonicalId],
          liveHistory[item.canonicalId],
          liveDecisions[item.canonicalId],
          language,
        ),
      ),
    [language, liveDecisions, liveDetails, liveHistory, liveList],
  )

  const demoIncidents = useMemo(
    () => demoState.incidents.map((incident) => buildDemoIncidentView(incident)),
    [demoState.incidents],
  )

  const currentIncidents = mode === 'demo' ? demoIncidents : liveIncidents
  const selectedIncidentId =
    mode === 'demo' ? demoState.selectedIncidentId : liveSelectedIncidentId

  const selectedIncident = useMemo(
    () =>
      currentIncidents.find((incident) => incident.canonicalId === selectedIncidentId) ?? null,
    [currentIncidents, selectedIncidentId],
  )

  useEffect(() => {
    if (selectedIncidentId) {
      setMapFocusRequest((current) => current + 1)
    }
  }, [mode, selectedIncidentId])

  const selectedDecision = useMemo(() => {
    if (!selectedIncident) {
      return null
    }

    if (mode === 'demo') {
      return (demoState.generatedDecisions[selectedIncident.canonicalId] ??
        null) as ForecastDecisionView | null
    }

    return buildLiveDecisionView(
      liveDecisions[selectedIncident.canonicalId] ?? null,
      selectedIncident,
      language,
    )
  }, [demoState.generatedDecisions, language, liveDecisions, mode, selectedIncident])

  async function selectLiveIncident(canonicalId: string) {
    setLiveSelectedIncidentId(canonicalId)

    const detail =
      liveDetails[canonicalId] ?? (await fetchOperatorIncidentDetail(canonicalId))
    if (!liveDetails[canonicalId]) {
      setLiveDetails((current) => ({ ...current, [canonicalId]: detail }))
    }

    const historyItems =
      liveHistory[canonicalId] ?? (await fetchOperatorIncidentHistory(canonicalId))
    if (!liveHistory[canonicalId]) {
      setLiveHistory((current) => ({ ...current, [canonicalId]: historyItems }))
    }

    if (detail.zoneId) {
      const zoneDecision =
        liveDecisions[canonicalId] ?? (await fetchOperatorZoneDecision(detail.zoneId))
      if (!liveDecisions[canonicalId]) {
        setLiveDecisions((current) => ({ ...current, [canonicalId]: zoneDecision }))
      }
    }
  }

  function handleSelectIncident(incidentId: string) {
    setMapFocusRequest((current) => current + 1)

    if (mode === 'demo') {
      const demoIncident = demoState.incidents.find((item) => item.canonicalId === incidentId)
      setDemoState((current) => ({
        ...current,
        selectedIncidentId: incidentId,
        generatedDecisions:
          demoIncident && !current.generatedDecisions[incidentId]
            ? {
                ...current.generatedDecisions,
                [incidentId]: generateDecision(demoIncident),
              }
            : current.generatedDecisions,
      }))
      return
    }

    selectLiveIncident(incidentId).catch((error) => {
      console.error(error)
    })
  }

  function handleToggleMode() {
    setMode((current) => (current === 'demo' ? 'live' : 'demo'))
  }

  function handleResetDemo() {
    setDemoState(createDemoSession())
    setMapFocusRequest((current) => current + 1)
  }

  function handleToggleLanguage() {
    setLanguage((current) => (current === 'bg' ? 'en' : 'bg'))
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      <TopBar
        mode={mode}
        language={language}
        summary={liveSummary}
        onToggleMode={handleToggleMode}
        onResetDemo={handleResetDemo}
        onToggleLanguage={handleToggleLanguage}
      />

      <main className="grid h-[calc(100vh-56px)] flex-1 gap-2 overflow-hidden px-2 py-2 lg:grid-cols-[228px_minmax(0,1fr)_344px] xl:grid-cols-[236px_minmax(0,1fr)_360px]">
        <Sidebar
          incidents={currentIncidents}
          selectedIncidentId={selectedIncidentId}
          onSelectIncident={handleSelectIncident}
          language={language}
        />

        <MapView
          incidents={currentIncidents}
          selectedIncidentId={selectedIncidentId}
          decision={selectedDecision}
          language={language}
          focusRequest={mapFocusRequest}
          onSelectIncident={handleSelectIncident}
        />

        <IncidentPanel
          incident={selectedIncident}
          decision={selectedDecision}
          language={language}
        />
      </main>
    </div>
  )
}

export default Dashboard
