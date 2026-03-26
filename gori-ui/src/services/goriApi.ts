import type {
  OperatorIncidentDetailApi,
  OperatorIncidentHistoryApiItem,
  OperatorIncidentListItemApi,
  OperatorSummaryApi,
  OperatorZoneDecisionApi,
} from '../types/gori'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchOperatorSummary() {
  return fetchJson<OperatorSummaryApi>('/api/operator/summary')
}

export function fetchOperatorIncidents() {
  return fetchJson<OperatorIncidentListItemApi[]>('/api/incidents?role=operator')
}

export function fetchOperatorIncidentDetail(canonicalId: string) {
  return fetchJson<OperatorIncidentDetailApi>(
    `/api/incidents/${encodeURIComponent(canonicalId)}?role=operator`,
  )
}

export function fetchOperatorIncidentHistory(canonicalId: string) {
  return fetchJson<OperatorIncidentHistoryApiItem[]>(
    `/api/incidents/${encodeURIComponent(canonicalId)}/history?role=operator`,
  )
}

export function fetchOperatorZoneDecision(zoneId: string) {
  return fetchJson<OperatorZoneDecisionApi>(
    `/api/zones/${encodeURIComponent(zoneId)}/decision?role=operator`,
  )
}
