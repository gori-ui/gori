import {
  t,
  translateLifecycle,
  translatePriorityCue,
  translateSeverity,
  translateSpreadPressure,
} from '../../lib/translations'
import type { AppLanguage, OperatorIncidentView } from '../../types/gori'

type IncidentListItemProps = {
  incident: OperatorIncidentView
  isSelected: boolean
  onSelect: () => void
  language: AppLanguage
}

const severityChipClasses: Record<OperatorIncidentView['severityLevel'], string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  major: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  minor: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
}

const spreadChipClasses: Record<OperatorIncidentView['spreadPressure'], string> = {
  high: 'border-red-500/25 bg-red-500/10 text-red-200',
  elevated: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
  moderate: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200',
  low: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
}

function IncidentListItem({
  incident,
  isSelected,
  onSelect,
  language,
}: IncidentListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border px-2 py-2 text-left transition ${
        isSelected
          ? 'border-accent/90 bg-[#17120f] shadow-[inset_0_0_0_1px_rgba(255,107,61,0.22),0_0_0_1px_rgba(255,107,61,0.12)]'
          : 'border-slate-800/70 bg-[#0f141a] opacity-34 hover:border-slate-700 hover:opacity-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${
              isSelected ? 'text-ink' : 'text-slate-300'
            }`}
          >
            {incident.zoneLabel}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">{incident.regionLabel}</div>
        </div>

        <span
          className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] ${
            isSelected
              ? 'border-accent/20 bg-accent/6 text-orange-100'
              : 'border-slate-700/70 bg-slate-800/25 text-slate-500'
          }`}
        >
          {translatePriorityCue(language, incident.priorityCue)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] ${severityChipClasses[incident.severityLevel]} ${
            isSelected ? '' : 'opacity-70'
          }`}
        >
          {translateSeverity(language, incident.severityLevel)}
        </span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] ${spreadChipClasses[incident.spreadPressure]} ${
            isSelected ? '' : 'opacity-70'
          }`}
        >
          {translateSpreadPressure(language, incident.spreadPressure)}
        </span>
        {isSelected ? (
          <span className="rounded-full border border-accent/18 bg-accent/8 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-orange-100">
            {translateLifecycle(language, incident.lifecycleState)}
          </span>
        ) : null}
      </div>

      <dl className="mt-1 grid grid-cols-[56px_1fr] gap-x-2 gap-y-0.5 text-[9px]">
        <dt className="uppercase tracking-[0.14em] text-slate-500">{t(language, 'status')}</dt>
        <dd className="m-0 text-slate-200">{incident.status}</dd>
        <dt className="uppercase tracking-[0.14em] text-slate-500">
          {isSelected ? t(language, 'lastUpdated') : t(language, 'priorityWindow')}
        </dt>
        <dd className="m-0 text-slate-300">
          {isSelected ? incident.lastUpdated : incident.responseWindow}
        </dd>
      </dl>
    </button>
  )
}

export default IncidentListItem
