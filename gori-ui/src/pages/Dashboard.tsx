import { useState } from 'react'

import IncidentPanel from '../components/incident/IncidentPanel'
import { mockIncidents } from '../components/incident/mockIncidents'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import MapView from '../components/map/MapView'

function Dashboard() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    mockIncidents[0]?.canonicalId ?? null,
  )

  const selectedIncident =
    mockIncidents.find((incident) => incident.canonicalId === selectedIncidentId) ??
    null

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      <TopBar />

      <main className="grid flex-1 gap-4 px-4 pb-4 pt-3 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <Sidebar
          incidents={mockIncidents}
          selectedIncidentId={selectedIncidentId}
          onSelectIncident={setSelectedIncidentId}
        />

        <MapView
          incidents={mockIncidents}
          selectedIncidentId={selectedIncidentId}
          onSelectIncident={setSelectedIncidentId}
        />

        <IncidentPanel incident={selectedIncident} />
      </main>
    </div>
  )
}

export default Dashboard
