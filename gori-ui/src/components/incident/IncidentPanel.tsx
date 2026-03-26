import type { ReactNode } from 'react'

import {
  t,
  translateDecisionReason,
  translateDirection,
  translateLifecycle,
  translateOperationalPriority,
  translatePriorityCue,
  translateSeverity,
  translateSpreadPressure,
} from '../../lib/translations'
import type {
  AppLanguage,
  ForecastDecisionView,
  OperatorIncidentView,
} from '../../types/gori'

type IncidentPanelProps = {
  incident: OperatorIncidentView | null
  decision: ForecastDecisionView | null
  language: AppLanguage
}

const severityChipClasses: Record<OperatorIncidentView['severityLevel'], string> = {
  critical: 'border-red-500/24 bg-red-500/8 text-red-200',
  major: 'border-orange-500/24 bg-orange-500/8 text-orange-200',
  minor: 'border-yellow-500/24 bg-yellow-500/8 text-yellow-200',
}

const lifecycleChipClasses: Record<OperatorIncidentView['lifecycleState'], string> = {
  active: 'border-red-500/18 bg-red-500/8 text-red-100',
  stabilizing: 'border-slate-500/18 bg-slate-500/8 text-slate-200',
  contained: 'border-slate-500/18 bg-slate-500/8 text-slate-300',
}

const pressureChipClasses: Record<OperatorIncidentView['spreadPressure'], string> = {
  high: 'border-red-500/18 bg-red-500/8 text-red-200',
  elevated: 'border-orange-500/18 bg-orange-500/8 text-orange-200',
  moderate: 'border-slate-500/18 bg-slate-500/8 text-slate-200',
  low: 'border-slate-500/18 bg-slate-500/8 text-slate-300',
}

function DetailSection({
  title,
  children,
  dominant = false,
}: {
  title: string
  children: ReactNode
  dominant?: boolean
}) {
  return (
    <section
      className={
        dominant
          ? 'border border-accent/28 bg-[#1a110d] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,107,61,0.12)]'
          : 'border-l border-slate-800 bg-[#0e141a] p-2.5'
      }
    >
      <h3
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
          dominant ? 'text-orange-100' : 'text-slate-500'
        }`}
      >
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function IncidentPanel({ incident, decision, language }: IncidentPanelProps) {
  if (!incident) {
    return (
      <aside className="flex h-full min-h-0 items-center justify-center border border-border bg-panel p-4 text-center text-sm text-slate-400">
        {t(language, 'noIncidentSelected')}
      </aside>
    )
  }

  const prioritizedTargets = decision?.targets ?? []
  const topTarget = prioritizedTargets[0] ?? null
  const directionLabel = decision?.spreadDirection
    ? translateDirection(language, decision.spreadDirection)
    : decision?.spreadDirectionLabel ?? '-'

  const actionText = decision
    ? topTarget
      ? language === 'bg'
        ? `Действие: ранно предупреждение и защита за ${topTarget.name}.`
        : `Action: early warning and protection for ${topTarget.name}.`
      : decision.recommendedAction
    : language === 'bg'
      ? 'Няма активен риск. Продължава наблюдение.'
      : 'No active risk. Monitoring continues.'

  const situationText = decision
    ? topTarget
      ? language === 'bg'
        ? `Посока: ${directionLabel}. Риск: ${topTarget.name} ${topTarget.horizon}.`
        : `Direction: ${directionLabel}. Risk: ${topTarget.name} ${topTarget.horizon}.`
      : decision.summary
    : language === 'bg'
      ? 'Няма активен риск.'
      : 'No active risk.'

  const confidenceLine = `${incident.confidenceLabel} • ${incident.lastUpdated} • ${incident.signals.length} ${
    language === 'bg' ? 'източника' : 'sources'
  }`
  const compactReasons = (decision?.reasoning ?? []).slice(0, 3)

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-panel">
      <div className="shrink-0 p-1.5 pb-0">
        <DetailSection title={t(language, 'incidentDetail')}>
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">
                  {incident.incidentId}
                </div>
                <div className="mt-0.5 text-[10px] leading-4 text-slate-400">
                  {incident.zoneLabel} · {incident.regionLabel}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] ${severityChipClasses[incident.severityLevel]}`}
                >
                  {translateSeverity(language, incident.severityLevel)}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] ${lifecycleChipClasses[incident.lifecycleState]}`}
                >
                  {translateLifecycle(language, incident.lifecycleState)}
                </span>
                <span className="rounded-full border border-accent/18 bg-accent/8 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-orange-100">
                  {translatePriorityCue(language, incident.priorityCue)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-[9px] text-slate-300">
              <span className="truncate">{incident.status}</span>
              <span className="shrink-0 text-slate-500">{incident.lastUpdated}</span>
            </div>
          </div>
        </DetailSection>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 pt-1.5">
        <div className="space-y-1.5">
          <DetailSection title={t(language, 'recommendedResponse')} dominant>
            <div className="space-y-2 text-[10px]">
              <p className="text-[11px] leading-5 text-orange-50">{actionText}</p>
              {decision ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="uppercase tracking-[0.16em] text-orange-100/70">
                    {t(language, 'decisionPriority')}
                  </span>
                  <span className="text-orange-50">
                    {translateOperationalPriority(language, decision.operationalPriority)}
                  </span>
                </div>
              ) : null}
            </div>
          </DetailSection>

          <DetailSection title={t(language, 'direction')}>
            <div className="space-y-2 text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-200">{directionLabel}</span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.14em] ${pressureChipClasses[incident.spreadPressure]}`}
                >
                  {translateSpreadPressure(language, incident.spreadPressure)}
                </span>
              </div>
              {decision ? <p className="leading-5 text-slate-300">{situationText}</p> : null}
            </div>
          </DetailSection>

          {decision ? (
            <DetailSection title={t(language, 'placesAtRisk')}>
              {prioritizedTargets.length > 0 ? (
                <ul className="space-y-1.5 text-[10px] text-slate-200">
                  {prioritizedTargets.slice(0, 4).map((target) => (
                    <li
                      key={target.id}
                      className="flex items-center justify-between gap-3 border-l border-slate-700 pl-2"
                    >
                      <span className="truncate text-slate-200">{target.name}</span>
                      <span className="shrink-0 text-slate-400">{target.horizon}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] leading-5 text-slate-400">
                  {t(language, 'noConfirmedTargets')}
                </p>
              )}
            </DetailSection>
          ) : null}

          {compactReasons.length > 0 ? (
            <DetailSection title={t(language, 'reasoning')}>
              <ul className="space-y-1 text-[10px] text-slate-300">
                {compactReasons.map((reason) => (
                  <li key={reason} className="leading-5">
                    • {translateDecisionReason(language, reason)}
                  </li>
                ))}
              </ul>
            </DetailSection>
          ) : null}

          <DetailSection title={t(language, 'trustSignals')}>
            <div className="text-[10px] leading-5 text-slate-300">{confidenceLine}</div>
          </DetailSection>
        </div>
      </div>
    </aside>
  )
}

export default IncidentPanel
