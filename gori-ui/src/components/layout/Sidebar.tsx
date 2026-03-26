import { t } from '../../lib/translations'
import type { AppLanguage, OperatorIncidentView } from '../../types/gori'
import IncidentListItem from '../incident/IncidentListItem'

type SidebarProps = {
  incidents: OperatorIncidentView[]
  selectedIncidentId: string | null
  onSelectIncident: (incidentId: string) => void
  language: AppLanguage
}

function Sidebar({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  language,
}: SidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-panel/95">
      <div className="border-b border-border px-3 py-2.5">
        <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
          {t(language, 'sidebarTitle')}
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">{t(language, 'sidebarSubtitle')}</p>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
        {incidents.length > 0 ? (
          incidents.map((incident) => (
            <IncidentListItem
              key={incident.canonicalId}
              incident={incident}
              isSelected={incident.canonicalId === selectedIncidentId}
              onSelect={() => onSelectIncident(incident.canonicalId)}
              language={language}
            />
          ))
        ) : (
          <div className="flex min-h-[180px] items-center justify-center border border-dashed border-border px-4 text-center text-sm text-slate-400">
            {t(language, 'sidebarEmpty')}
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
