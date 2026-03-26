import { useMemo, useState } from 'react'

import { generateDecision, type GeneratedDecision } from '../components/incident/decisionEngine'
import IncidentPanel from '../components/incident/IncidentPanel'
import { mockIncidents } from '../components/incident/mockIncidents'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import MapView from '../components/map/MapView'

function Dashboard() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    mockIncidents[0]?.canonicalId ?? null,
  )
  const [generatedDecisions, setGeneratedDecisions] = useState<Record<string, GeneratedDecision>>({})

  const selectedIncident = useMemo(
    () =>
      mockIncidents.find((incident) => incident.canonicalId === selectedIncidentId) ??
      null,
    [selectedIncidentId],
  )

  const selectedDecision =
    selectedIncident ? generatedDecisions[selectedIncident.canonicalId] ?? null : null

  function handleGenerateDecision() {
    if (!selectedIncident) {
      return
    }

    setGeneratedDecisions((current) => ({
      ...current,
      [selectedIncident.canonicalId]: generateDecision(selectedIncident),
    }))
  }

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      <TopBar />

      <main className="grid flex-1 gap-2 px-2 pb-2 pt-2 lg:grid-cols-[278px_minmax(0,1fr)_340px] xl:grid-cols-[286px_minmax(0,1fr)_360px]">
        <Sidebar
          incidents={mockIncidents}
          selectedIncidentId={selectedIncidentId}
          onSelectIncident={setSelectedIncidentId}
        />

        <MapView
          incidents={mockIncidents}
          selectedIncidentId={selectedIncidentId}
          decision={selectedDecision}
          onSelectIncident={setSelectedIncidentId}
        />

        <IncidentPanel
          incident={
            mockIncidents.find((incident) => incident.canonicalId === selectedIncidentId) ??
            null
          }
          decision={selectedDecision}
          onGenerateDecision={handleGenerateDecision}
        />
      </main>
    </div>
  )
}

export default Dashboard
