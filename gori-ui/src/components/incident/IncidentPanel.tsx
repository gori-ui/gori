import type { ReactNode } from 'react'

import type { GeneratedDecision } from './decisionEngine'
import SignalTimelineItem from './SignalTimelineItem'
import type { MockIncident } from './mockIncidents'

type IncidentPanelProps = {
  incident: MockIncident | null
  decision: GeneratedDecision | null
  onGenerateDecision: () => void
}

const severityChipClasses: Record<MockIncident['severityLevel'], string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-200',
  major: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  minor: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
}

const lifecycleChipClasses: Record<MockIncident['lifecycleState'], string> = {
  active: 'border-accent/25 bg-accent/10 text-orange-100',
  stabilizing: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100',
  contained: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
}

const pressureChipClasses: Record<MockIncident['spreadPressure'], string> = {
  high: 'border-red-500/25 bg-red-500/10 text-red-200',
  elevated: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
  moderate: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200',
  low: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="border border-border bg-[#10161d] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function IncidentPanel({
  incident,
  decision,
  onGenerateDecision,
}: IncidentPanelProps) {
  if (!incident) {
    return (
      <aside className="flex min-h-[320px] items-center justify-center border border-border bg-panel p-6 text-center text-sm text-slate-400">
        No incident selected.
      </aside>
    )
  }

  return (
    <aside className="flex min-h-[320px] flex-col border border-border bg-panel">
      <div className="overflow-y-auto p-2">
        <DetailSection title="Incident Detail">
          <div className="space-y-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
                Incident
              </p>
              <h2 className="mt-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-ink">
                {incident.incidentId}
              </h2>
            </div>
            <div className="grid gap-1 text-[10px] text-slate-300">
              <div className="flex justify-between gap-3">
                <span className="uppercase tracking-[0.16em] text-slate-500">
                  Zone
                </span>
                <span>{incident.zoneLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="uppercase tracking-[0.16em] text-slate-500">
                  Region
                </span>
                <span>{incident.regionLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
              <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-orange-100">
                {incident.priorityCue}
              </span>
            </div>
          </div>
        </DetailSection>

        <div className="mt-2 grid gap-2">
          <DetailSection title="Operational Status">
            <dl className="space-y-2 text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.16em] text-slate-500">
                  Status
                </dt>
                <dd className="m-0 text-right text-slate-200">{incident.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.16em] text-slate-500">
                  Signals
                </dt>
                <dd className="m-0 text-slate-200">{incident.signalCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.16em] text-slate-500">
                  Update
                </dt>
                <dd className="m-0 text-right text-slate-200">{incident.lastUpdated}</dd>
              </div>
            </dl>
          </DetailSection>

          <DetailSection title="Spread Context">
            <div className="space-y-2 text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <span className="uppercase tracking-[0.16em] text-slate-500">
                  Pressure
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${pressureChipClasses[incident.spreadPressure]}`}
                >
                  {incident.spreadPressure}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="uppercase tracking-[0.16em] text-slate-500">
                  Wind
                </span>
                <span className="text-slate-200">
                  {incident.windDirection} · {incident.windSpeedKmh} km/h
                </span>
              </div>
              <p className="leading-5 text-slate-300">{incident.terrainSummary}</p>
              <p className="leading-5 text-slate-400">{incident.localContext}</p>
            </div>
          </DetailSection>

          <DetailSection title="Decision">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onGenerateDecision}
                className="w-full rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100 transition hover:border-accent/50 hover:bg-accent/15"
              >
                Generate Decision
              </button>

              {decision ? (
                <div className="space-y-3 text-[10px]">
                  <div className="border border-accent/20 bg-accent/10 p-2.5 text-orange-50">
                    <div className="font-medium uppercase tracking-[0.16em] text-orange-100">
                      Recommended Action
                    </div>
                    <p className="mt-1 leading-5">{decision.recommendedAction}</p>
                  </div>

                  <dl className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="uppercase tracking-[0.16em] text-slate-500">
                        Direction
                      </dt>
                      <dd className="m-0 text-slate-200">{decision.spreadDirectionLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="uppercase tracking-[0.16em] text-slate-500">
                        Wind support
                      </dt>
                      <dd className="m-0 text-slate-200">{decision.windSupport}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="uppercase tracking-[0.16em] text-slate-500">
                        +15 reach
                      </dt>
                      <dd className="m-0 text-slate-200">{decision.plus15ReachKm.toFixed(1)} km</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="uppercase tracking-[0.16em] text-slate-500">
                        +30 reach
                      </dt>
                      <dd className="m-0 text-slate-200">{decision.plus30ReachKm.toFixed(1)} km</dd>
                    </div>
                  </dl>

                  <p className="leading-5 text-slate-300">{decision.summary}</p>
                  <p className="leading-5 text-slate-400">{decision.rationale}</p>
                </div>
              ) : (
                <p className="text-[10px] leading-5 text-slate-400">
                  Generate a decision to project the likely spread corridor and see which target is threatened first.
                </p>
              )}
            </div>
          </DetailSection>

          <DetailSection title="Priority Targets">
            {decision && decision.targets.length > 0 ? (
              <ul className="space-y-2 text-[10px] text-slate-200">
                {decision.targets.slice(0, 4).map((target) => (
                  <li key={target.id} className="border-l border-border pl-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>{target.name}</span>
                      <span className="text-slate-400">{target.horizon}</span>
                    </div>
                    <div className="mt-1 text-slate-400">
                      {target.type} · {target.priority} · {target.distanceKm.toFixed(1)} km
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] leading-5 text-slate-400">
                No forecast target has been evaluated yet.
              </p>
            )}
          </DetailSection>

          <DetailSection title="Verification">
            <dl className="space-y-2 text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.16em] text-slate-500">
                  Confidence
                </dt>
                <dd className="m-0 text-slate-200">{incident.confidenceLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.16em] text-slate-500">
                  Source
                </dt>
                <dd className="m-0 text-right text-slate-200">
                  {incident.verificationStatus}
                </dd>
              </div>
            </dl>
          </DetailSection>

          <DetailSection title="Signals">
            <ul className="space-y-1 text-[10px] text-slate-200">
              {incident.signals.map((signal) => (
                <li key={signal} className="border-l border-border pl-2">
                  {signal}
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection title="Timeline">
            <div>
              {incident.timeline.map((entry, index) => (
                <SignalTimelineItem
                  key={`${incident.canonicalId}-${entry.time}-${index}`}
                  entry={entry}
                  isLast={index === incident.timeline.length - 1}
                />
              ))}
            </div>
          </DetailSection>
        </div>
      </div>
    </aside>
  )
}

export default IncidentPanel
