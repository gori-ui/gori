import IncidentListItem from '../incident/IncidentListItem'
import type { MockIncident } from '../incident/mockIncidents'

type SidebarProps = {
  incidents: MockIncident[]
  selectedIncidentId: string | null
  onSelectIncident: (incidentId: string) => void
}

function Sidebar({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}: SidebarProps) {
  return (
    <aside className="flex min-h-[320px] flex-col rounded-2xl border border-border bg-panel">
      <div className="border-b border-border px-4 py-4">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-[0.16em] text-ink">
          Active Incidents
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Ordered by operational relevance
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {incidents.length > 0 ? (
          incidents.map((incident) => (
            <IncidentListItem
              key={incident.canonicalId}
              incident={incident}
              isSelected={incident.canonicalId === selectedIncidentId}
              onSelect={() => onSelectIncident(incident.canonicalId)}
            />
          ))
        ) : (
          <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-slate-400">
            No active incidents currently detected.
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
