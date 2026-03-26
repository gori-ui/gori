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
    <aside className="flex min-h-[320px] flex-col border border-border bg-panel">
      <div className="border-b border-border px-3 py-3">
        <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
          Active Incidents
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Ordered by operational relevance
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
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
          <div className="flex min-h-[180px] items-center justify-center border border-dashed border-border px-4 text-center text-sm text-slate-400">
            No active incidents currently detected.
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
