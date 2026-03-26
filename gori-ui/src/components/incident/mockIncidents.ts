export type MockIncidentTimelineEntry = {
  time: string
  label: string
}

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

export type ExposureTarget = {
  id: string
  name: string
  type: ExposureTargetType
  latitude: number
  longitude: number
}

export type MockIncident = {
  canonicalId: string
  incidentId: string
  zoneLabel: string
  regionLabel: string
  severityLevel: 'critical' | 'major' | 'minor'
  lifecycleState: 'active' | 'stabilizing' | 'contained'
  status: string
  spreadPressure: 'high' | 'elevated' | 'moderate' | 'low'
  signalCount: number
  lastUpdated: string
  priorityCue: 'Immediate' | 'Priority' | 'Monitor' | 'Watch'
  confidenceLabel: string
  responseWindow: string
  verificationStatus: string
  terrainSummary: string
  localContext: string
  impactForecast: string
  resourcesAssigned: string
  latitude: number
  longitude: number
  windDirection: WindDirection
  windSpeedKmh: number
  signals: string[]
  timeline: MockIncidentTimelineEntry[]
  exposureTargets: ExposureTarget[]
}

export const mockIncidents: MockIncident[] = [
  {
    canonicalId: 'GORI-CAN-2401',
    incidentId: 'Z4-2026-0314',
    zoneLabel: 'Zone 4',
    regionLabel: 'Struma Southwest',
    severityLevel: 'critical',
    lifecycleState: 'active',
    status: 'Escalating on ridge line',
    spreadPressure: 'high',
    signalCount: 6,
    lastUpdated: 'Updated 2m ago',
    priorityCue: 'Immediate',
    confidenceLabel: '94% verified',
    responseWindow: 'ETA 12m',
    verificationStatus: 'Cross-confirmed',
    terrainSummary: 'Steep forested slope with funneling valley winds',
    localContext: 'Dry pine understory, exposed western corridor',
    impactForecast: 'Westbound advance likely if wind holds through the next 30 minutes.',
    resourcesAssigned: '2 air / 3 ground',
    latitude: 41.95,
    longitude: 23.13,
    windDirection: 'west',
    windSpeedKmh: 28,
    signals: [
      'Satellite hotspot',
      'Citizen report',
      'Operational confirmation',
      'Thermal drift alert',
    ],
    timeline: [
      { time: '10:12', label: 'Satellite anomaly detected' },
      { time: '10:16', label: 'Citizen report received' },
      { time: '10:21', label: 'Operational confirmation issued' },
      { time: '10:28', label: 'Spread pressure updated to high' },
    ],
    exposureTargets: [
      {
        id: 'kresna-west',
        name: 'Kresna west edge',
        type: 'settlement',
        latitude: 41.91,
        longitude: 23.03,
      },
      {
        id: 'e79-corridor',
        name: 'E79 corridor',
        type: 'road',
        latitude: 41.925,
        longitude: 23.055,
      },
      {
        id: 'valley-substation',
        name: 'Valley substation',
        type: 'utility',
        latitude: 41.936,
        longitude: 23.072,
      },
      {
        id: 'south-farm',
        name: 'South orchard belt',
        type: 'farm',
        latitude: 41.905,
        longitude: 23.165,
      },
    ],
  },
  {
    canonicalId: 'GORI-CAN-2402',
    incidentId: 'Z7-2026-0316',
    zoneLabel: 'Zone 7',
    regionLabel: 'Eastern Corridor',
    severityLevel: 'major',
    lifecycleState: 'active',
    status: 'Expanding east flank',
    spreadPressure: 'elevated',
    signalCount: 4,
    lastUpdated: 'Updated 8m ago',
    priorityCue: 'Priority',
    confidenceLabel: '88% verified',
    responseWindow: 'ETA 24m',
    verificationStatus: 'Field relay pending',
    terrainSummary: 'Open scrub edge with exposed transport corridor',
    localContext: 'Crosswinds across agricultural perimeter',
    impactForecast: 'Fire likely to push north-east along the open flank if gusts sustain.',
    resourcesAssigned: '1 air / 2 ground',
    latitude: 43.2141,
    longitude: 27.9147,
    windDirection: 'north-east',
    windSpeedKmh: 22,
    signals: [
      'Satellite hotspot',
      'Patrol relay',
      'Wind shift advisory',
    ],
    timeline: [
      { time: '09:44', label: 'Thermal cluster identified' },
      { time: '09:51', label: 'Patrol relay confirms perimeter breach' },
      { time: '10:02', label: 'Wind shift advisory received' },
      { time: '10:09', label: 'East flank escalation noted' },
    ],
    exposureTargets: [
      {
        id: 'varna-east-farm',
        name: 'East ridge farms',
        type: 'farm',
        latitude: 43.252,
        longitude: 27.982,
      },
      {
        id: 'coastal-road',
        name: 'A2 feeder road',
        type: 'road',
        latitude: 43.238,
        longitude: 27.958,
      },
      {
        id: 'village-outskirts',
        name: 'Benkovski outskirts',
        type: 'settlement',
        latitude: 43.247,
        longitude: 27.972,
      },
    ],
  },
  {
    canonicalId: 'GORI-CAN-2403',
    incidentId: 'Z2-2026-0312',
    zoneLabel: 'Zone 2',
    regionLabel: 'Southern Basin',
    severityLevel: 'major',
    lifecycleState: 'stabilizing',
    status: 'Holding containment line',
    spreadPressure: 'moderate',
    signalCount: 3,
    lastUpdated: 'Updated 21m ago',
    priorityCue: 'Monitor',
    confidenceLabel: '81% verified',
    responseWindow: 'ETA 38m',
    verificationStatus: 'Ground telemetry stable',
    terrainSummary: 'Valley floor with brush and moderate slope pressure',
    localContext: 'Contained edge with residual heat persistence',
    impactForecast: 'Northbound spotting remains possible if gusts increase.',
    resourcesAssigned: '3 ground',
    latitude: 42.1354,
    longitude: 24.7453,
    windDirection: 'north',
    windSpeedKmh: 16,
    signals: [
      'Operational confirmation',
      'Ground crew telemetry',
      'Thermal persistence',
    ],
    timeline: [
      { time: '08:58', label: 'Operational confirmation logged' },
      { time: '09:11', label: 'Ground telemetry indicates slower spread' },
      { time: '09:24', label: 'Containment line holding' },
      { time: '09:47', label: 'Incident shifted to stabilizing' },
    ],
    exposureTargets: [
      {
        id: 'north-track',
        name: 'North access track',
        type: 'road',
        latitude: 42.164,
        longitude: 24.747,
      },
      {
        id: 'upper-fields',
        name: 'Upper basin fields',
        type: 'farm',
        latitude: 42.172,
        longitude: 24.739,
      },
    ],
  },
  {
    canonicalId: 'GORI-CAN-2404',
    incidentId: 'Z9-2026-0311',
    zoneLabel: 'Zone 9',
    regionLabel: 'Northern Perimeter',
    severityLevel: 'minor',
    lifecycleState: 'contained',
    status: 'Residual monitoring only',
    spreadPressure: 'low',
    signalCount: 2,
    lastUpdated: 'Updated 47m ago',
    priorityCue: 'Watch',
    confidenceLabel: '76% verified',
    responseWindow: 'Standby',
    verificationStatus: 'Residual heat only',
    terrainSummary: 'Patch woodland near a local service road',
    localContext: 'Minimal perimeter activity remains',
    impactForecast: 'No meaningful spread expected unless wind changes sharply.',
    resourcesAssigned: '1 ground',
    latitude: 43.0757,
    longitude: 25.6172,
    windDirection: 'east',
    windSpeedKmh: 9,
    signals: ['Citizen report', 'Operator validation'],
    timeline: [
      { time: '07:32', label: 'Citizen report received' },
      { time: '07:46', label: 'Operator validation completed' },
      { time: '08:04', label: 'Containment confirmed' },
      { time: '08:22', label: 'Monitoring posture reduced' },
    ],
    exposureTargets: [
      {
        id: 'service-road',
        name: 'Local service road',
        type: 'road',
        latitude: 43.077,
        longitude: 25.645,
      },
    ],
  },
]
