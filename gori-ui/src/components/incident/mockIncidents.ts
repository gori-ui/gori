export type MockIncidentTimelineEntry = {
  time: string
  label: string
}

export type MockIncident = {
  canonicalId: string
  incidentId: string
  zoneLabel: string
  severityLevel: 'critical' | 'major' | 'minor'
  lifecycleState: 'active' | 'stabilizing' | 'contained'
  status: string
  spreadPressure: 'high' | 'elevated' | 'moderate' | 'low'
  signalCount: number
  lastUpdated: string
  priorityCue: 'Immediate' | 'Priority' | 'Monitor' | 'Watch'
  latitude: number
  longitude: number
  signals: string[]
  timeline: MockIncidentTimelineEntry[]
}

export const mockIncidents: MockIncident[] = [
  {
    canonicalId: 'GORI-CAN-2401',
    incidentId: 'Z4-2026-0314',
    zoneLabel: 'Zone 4',
    severityLevel: 'critical',
    lifecycleState: 'active',
    status: 'Escalating',
    spreadPressure: 'high',
    signalCount: 6,
    lastUpdated: 'Updated 2m ago',
    priorityCue: 'Immediate',
    latitude: 42.6977,
    longitude: 23.3219,
    signals: [
      'Satellite hotspot',
      'Citizen report',
      'Operational confirmation',
    ],
    timeline: [
      { time: '10:12', label: 'Satellite anomaly detected' },
      { time: '10:16', label: 'Citizen report received' },
      { time: '10:21', label: 'Operational confirmation issued' },
      { time: '10:28', label: 'Spread pressure updated to high' },
    ],
  },
  {
    canonicalId: 'GORI-CAN-2402',
    incidentId: 'Z7-2026-0316',
    zoneLabel: 'Zone 7',
    severityLevel: 'major',
    lifecycleState: 'active',
    status: 'Expanding east flank',
    spreadPressure: 'elevated',
    signalCount: 4,
    lastUpdated: 'Updated 8m ago',
    priorityCue: 'Priority',
    latitude: 43.2141,
    longitude: 27.9147,
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
  },
  {
    canonicalId: 'GORI-CAN-2403',
    incidentId: 'Z2-2026-0312',
    zoneLabel: 'Zone 2',
    severityLevel: 'major',
    lifecycleState: 'stabilizing',
    status: 'Holding containment line',
    spreadPressure: 'moderate',
    signalCount: 3,
    lastUpdated: 'Updated 21m ago',
    priorityCue: 'Monitor',
    latitude: 42.1354,
    longitude: 24.7453,
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
  },
  {
    canonicalId: 'GORI-CAN-2404',
    incidentId: 'Z9-2026-0311',
    zoneLabel: 'Zone 9',
    severityLevel: 'minor',
    lifecycleState: 'contained',
    status: 'Residual monitoring only',
    spreadPressure: 'low',
    signalCount: 2,
    lastUpdated: 'Updated 47m ago',
    priorityCue: 'Watch',
    latitude: 43.0757,
    longitude: 25.6172,
    signals: [
      'Citizen report',
      'Operator validation',
    ],
    timeline: [
      { time: '07:32', label: 'Citizen report received' },
      { time: '07:46', label: 'Operator validation completed' },
      { time: '08:04', label: 'Containment confirmed' },
      { time: '08:22', label: 'Monitoring posture reduced' },
    ],
  },
]
