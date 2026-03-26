import type {
  OperatorIncidentDetailApi,
  OperatorIncidentHistoryApiItem,
  OperatorIncidentListItemApi,
  OperatorSummaryApi,
  OperatorZoneDecisionApi,
} from '../types/gori'

const API_BASE_URL = 'https://gori-production-66eb.up.railway.app'

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchOperatorSummary() {
  return fetchJson<OperatorSummaryApi>(apiUrl('/api/operator/summary'))
}

export function fetchOperatorIncidents() {
  return fetchJson<OperatorIncidentListItemApi[]>(
    apiUrl('/api/incidents?role=operator'),
  )
}

export function fetchOperatorIncidentDetail(canonicalId: string) {
  return fetchJson<OperatorIncidentDetailApi>(
    apiUrl(`/api/incidents/${encodeURIComponent(canonicalId)}?role=operator`),
  )
}

export function fetchOperatorIncidentHistory(canonicalId: string) {
  return fetchJson<OperatorIncidentHistoryApiItem[]>(
    apiUrl(
      `/api/incidents/${encodeURIComponent(canonicalId)}/history?role=operator`,
    ),
  )
}

export function fetchOperatorZoneDecision(zoneId: string) {
  return fetchJson<OperatorZoneDecisionApi>(
    apiUrl(`/api/zones/${encodeURIComponent(zoneId)}/decision?role=operator`),
  )
}
