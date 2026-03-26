export type AppMode = 'live' | 'demo'

export type AppLanguage = 'bg' | 'en'

export type WindDirection =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west'

export type ExposureTargetType = 'settlement' | 'road' | 'farm' | 'utility'

export type IncidentSeverity = 'critical' | 'major' | 'minor'

export type IncidentLifecycle = 'active' | 'stabilizing' | 'contained'

export type SpreadPressure = 'high' | 'elevated' | 'moderate' | 'low'

export type PriorityCue = 'Immediate' | 'Priority' | 'Monitor' | 'Watch'

export type TimelineEntry = {
  time: string
  label: string
}

export type ForecastTarget = {
  id: string
  name: string
  type: ExposureTargetType
  latitude: number
  longitude: number
  distanceKm: number
  horizon: '+15 min' | '+30 min'
  priority: 'Immediate' | 'Priority' | 'Monitor'
}

export type ForecastDecisionView = {
  spreadDirection: WindDirection | null
  spreadDirectionLabel: string
  windSpeedKmh: number | null
  windSupport: string
  plus15ReachKm: number
  plus30ReachKm: number
  corridorHalfAngleDeg: number
  recommendedAction: string
  summary: string
  rationale: string
  timeHorizons: string[]
  exposureConfidence: string | null
  operationalPriority: 'monitor' | 'prepare' | 'act' | null
  reasoning: string[]
  topTarget: ForecastTarget | null
  targets: ForecastTarget[]
}

export type OperatorExposureApi = {
  status?: string | null
  primaryDirection?: string | null
  direction?: string | null
  pressure?: string | null
  timeHorizon?: string[] | null
  horizon?: Record<string, string> | null
  confidence?: string | null
  summary?: string | null
  priority?: string | null
  reasoning?: string[] | null
  targets?: unknown[] | null
  basis?: string[] | null
  baseRadiusKm?: number | null
  forwardBias?: number | null
}

export type ComparisonLink = {
  id: string
  label: string
  url: string
}

export type OperatorIncidentView = {
  canonicalId: string
  incidentId: string
  zoneId: string | null
  zoneLabel: string
  regionLabel: string
  severityLevel: IncidentSeverity
  lifecycleState: IncidentLifecycle
  status: string
  spreadPressure: SpreadPressure
  signalCount: number
  lastUpdated: string
  priorityCue: PriorityCue
  confidenceLabel: string
  responseWindow: string
  verificationStatus: string
  terrainSummary: string
  localContext: string
  impactForecast: string
  resourcesAssigned: string
  latitude: number | null
  longitude: number | null
  windDirection: WindDirection | null
  windSpeedKmh: number | null
  signals: string[]
  timeline: TimelineEntry[]
  exposureTargets: Array<{
    id: string
    name: string
    type: ExposureTargetType
    latitude: number
    longitude: number
  }>
  comparisonLinks: ComparisonLink[]
  modeSource: AppMode
}

export type OperatorSummaryApi = {
  activeIncidentsCount: number
  criticalIncidentsCount: number
  activeCriticalIncidentsCount: number
  elevatedSpreadIncidentsCount: number
  containedIncidentsCount: number
  zonesWithElevatedSpread: number
  operatorAttentionCount: number
}

export type OperatorIncidentListItemApi = {
  canonicalId: string
  zoneId: string | null
  zoneLabel: string | null
  status: string | null
  lifecycleState: string | null
  severityLevel: string | null
  spreadPressure: string | null
  incidentPriority: string | null
  lastUpdatedAt: string | null
}

export type OperatorIncidentDetailApi = {
  canonicalId: string
  zoneId: string | null
  zoneLabel: string | null
  runtimeIncidentId: string | null
  status: string | null
  severityLevel: string | null
  lifecycleState: string | null
  location: {
    latitude: number
    longitude: number
  } | null
  firstObservedAt: string | null
  lastUpdatedAt: string | null
  sources: string[]
  signalsCount: number | null
  timelineSummary: Array<{
    timestamp: string | null
    type: string | null
    label: string | null
  }>
}

export type OperatorIncidentHistoryApiItem = {
  canonicalId: string | null
  zoneId: string | null
  zoneLabel: string | null
  severityLevel: string | null
  lifecycleState: string | null
  status: string | null
  lastUpdatedAt: string | null
  sources?: string[]
  signalsCount?: number | null
  timelineSummary?: Array<{
    timestamp: string | null
    type: string | null
    label: string | null
  }>
}

export type OperatorZoneDecisionApi = {
  zone: {
    id: string
    label: string
    region?: string | null
  }
  risk: {
    summary?: string | null
  } & Record<string, unknown>
  incident: {
    canonicalId?: string | null
    zoneId?: string | null
    severityLevel?: string | null
    lifecycleState?: string | null
    status?: string | null
    sources?: string[]
    signalsCount?: number | null
    timelineSummary?: Array<{
      timestamp: string | null
      type: string | null
      label: string | null
    }>
  }
  spread?: {
    status?: string | null
    spreadPressure?: string | null
    higherRiskDirection?: string | null
    lowerRiskDirection?: string | null
    terrainInfluence?: {
      slopeClass?: string | null
      terrainPressure?: string | null
    } | null
    note?: string | null
  } | null
  exposure?: OperatorExposureApi | null
  crossConfirmation?: {
    status?: string | null
    basis?: string | null
    note?: string | null
  } | null
  routing?: {
    direction?: string | null
    note?: string | null
    target?: {
      label?: string | null
    } | null
  } | null
  history?: Record<string, unknown> | null
  note?: string | null
}
