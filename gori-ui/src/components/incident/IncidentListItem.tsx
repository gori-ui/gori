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
      className={`w-full border px-2.5 py-2.5 text-left transition ${
        isSelected
          ? 'border-accent bg-[#181410] shadow-[inset_0_0_0_1px_rgba(255,107,61,0.18)]'
          : 'border-border bg-[#10161d] hover:border-slate-600 hover:bg-[#131b24]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">
            {incident.zoneLabel}
          </div>
          <div className="mt-1 truncate text-[10px] tracking-[0.18em] text-slate-500">
            {incident.canonicalId}
          </div>
        </div>

        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-100">
          {incident.priorityCue}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${severityChipClasses[incident.severityLevel]}`}
        >
          {incident.severityLevel}
        </span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${lifecycleChipClasses[incident.lifecycleState]}`}
        >
          {incident.lifecycleState}
        </span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${spreadChipClasses[incident.spreadPressure]}`}
        >
          {incident.spreadPressure}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-[44px_1fr] gap-x-2 gap-y-1.5 text-[10px]">
        <dt className="uppercase tracking-[0.14em] text-slate-500">Status</dt>
        <dd className="m-0 text-slate-200">{incident.status}</dd>
        <dt className="uppercase tracking-[0.14em] text-slate-500">Region</dt>
        <dd className="m-0 text-slate-200">{incident.regionLabel}</dd>
        <dt className="uppercase tracking-[0.14em] text-slate-500">State</dt>
        <dd className="m-0 text-slate-200">{toOperatorLabel(incident.lifecycleState)}</dd>
        <dt className="uppercase tracking-[0.14em] text-slate-500">Update</dt>
        <dd className="m-0 text-slate-200">{incident.lastUpdated}</dd>
      </dl>
    </button>
  )
}

export default IncidentListItem
