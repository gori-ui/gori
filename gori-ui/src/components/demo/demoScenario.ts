import { generateDecision } from '../incident/decisionEngine'
import { mockIncidents } from '../incident/mockIncidents'

export function createDemoSession() {
  const primaryIncident = mockIncidents[0] ?? null

  return {
    incidents: mockIncidents,
    selectedIncidentId: primaryIncident?.canonicalId ?? null,
    generatedDecisions: primaryIncident
      ? {
          [primaryIncident.canonicalId]: generateDecision(primaryIncident),
        }
      : {},
  }
}
