import SignalTimelineItem from './SignalTimelineItem'
import type { MockIncident } from './mockIncidents'

type IncidentPanelProps = {
  incident: MockIncident | null
}

const severityChipClasses: Record<NonNullable<MockIncident>['severityLevel'], string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  major: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  minor: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
}

const lifecycleChipClasses: Record<NonNullable<MockIncident>['lifecycleState'], string> = {
  active: 'border-accent/25 bg-accent/10 text-orange-100',
  stabilizing: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100',
  contained: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
}

const pressureChipClasses: Record<NonNullable<MockIncident>['spreadPressure'], string> = {
  high: 'border-red-500/25 bg-red-500/10 text-red-200',
  elevated: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
  moderate: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200',
  low: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
}

function IncidentPanel({ incident }: IncidentPanelProps) {
  if (!incident) {
    return (
      <aside className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-panel p-6 text-center text-sm text-slate-400">
        No incident selected.
      </aside>
    )
  }

  return (
    <aside className="flex min-h-[320px] flex-col rounded-2xl border border-border bg-panel">
      <div className="space-y-6 overflow-y-auto p-4">
        <section className="rounded-xl border border-border bg-[#111720] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Incident Header
          </p>
          <h2 className="mt-3 text-xl font-semibold text-ink">{incident.incidentId}</h2>
          <p className="mt-1 text-sm text-slate-400">{incident.zoneLabel}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${severityChipClasses[incident.severityLevel]}`}
            >
              Severity: {incident.severityLevel}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${lifecycleChipClasses[incident.lifecycleState]}`}
            >
              Lifecycle: {incident.lifecycleState}
            </span>
            <span className="rounded-full border border-slate-600 bg-slate-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-200">
              Status: {incident.status}
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-[#111720] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Operational Status
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Spread pressure</dt>
              <dd className="m-0">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${pressureChipClasses[incident.spreadPressure]}`}
                >
                  {incident.spreadPressure}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Signals</dt>
              <dd className="m-0 text-slate-200">{incident.signalCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Last update</dt>
              <dd className="m-0 text-slate-200">{incident.lastUpdated}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-[#111720] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Spread Context
          </h3>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {incident.zoneLabel} remains under {incident.spreadPressure} spread
            pressure with the incident currently {incident.lifecycleState}. Field
            monitoring is maintained while operators track additional signal
            convergence before escalation changes.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-[#111720] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Signals
          </h3>
          <ul className="mt-4 space-y-2 pl-5 text-sm text-slate-200">
            {incident.signals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-[#111720] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Timeline
          </h3>
          <div className="mt-4">
            {incident.timeline.map((entry, index) => (
              <SignalTimelineItem
                key={`${incident.canonicalId}-${entry.time}-${index}`}
                entry={entry}
                isLast={index === incident.timeline.length - 1}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}

export default IncidentPanel
