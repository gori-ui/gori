import type { MockIncident } from './mockIncidents'

type IncidentListItemProps = {
  incident: MockIncident
  isSelected: boolean
  onSelect: () => void
}

const severityChipClasses: Record<MockIncident['severityLevel'], string> = {
  critical:
    'border-red-500/30 bg-red-500/10 text-red-200',
  major:
    'border-orange-500/30 bg-orange-500/10 text-orange-200',
  minor:
    'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
}

const spreadChipClasses: Record<MockIncident['spreadPressure'], string> = {
  high: 'border-red-500/25 bg-red-500/10 text-red-200',
  elevated: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
  moderate: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200',
  low: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
}

const lifecycleChipClasses: Record<MockIncident['lifecycleState'], string> = {
  active: 'border-accent/25 bg-accent/10 text-orange-100',
  stabilizing: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100',
  contained: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
}

function toOperatorLabel(value: string) {
  return value.replace(/(^\w|-\w)/g, (match) => match.replace('-', ' ').toUpperCase())
}

function IncidentListItem({
  incident,
  isSelected,
  onSelect,
}: IncidentListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        isSelected
          ? 'border-accent bg-accent/8 shadow-[inset_0_0_0_1px_rgba(255,107,61,0.12)]'
          : 'border-border bg-[#111720] hover:border-slate-600 hover:bg-[#151c26]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{incident.zoneLabel}</div>
          <div className="mt-1 text-xs tracking-[0.14em] text-slate-500">
            {incident.canonicalId}
          </div>
        </div>

        <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-100">
          {incident.priorityCue}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${severityChipClasses[incident.severityLevel]}`}
        >
          {incident.severityLevel}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${lifecycleChipClasses[incident.lifecycleState]}`}
        >
          {incident.lifecycleState}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${spreadChipClasses[incident.spreadPressure]}`}
        >
          {incident.spreadPressure} spread
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-slate-500">Status</dt>
        <dd className="m-0 text-slate-200">{incident.status}</dd>
        <dt className="text-slate-500">Lifecycle</dt>
        <dd className="m-0 text-slate-200">
          {toOperatorLabel(incident.lifecycleState)}
        </dd>
        <dt className="text-slate-500">Updated</dt>
        <dd className="m-0 text-slate-200">{incident.lastUpdated}</dd>
      </dl>
    </button>
  )
}

export default IncidentListItem
