import type { MockIncidentTimelineEntry } from './mockIncidents'

type SignalTimelineItemProps = {
  entry: MockIncidentTimelineEntry
  isLast: boolean
}

function SignalTimelineItem({ entry, isLast }: SignalTimelineItemProps) {
  return (
    <div className="grid grid-cols-[56px_18px_1fr] gap-3">
      <div className="pt-0.5 text-xs font-medium tracking-[0.14em] text-slate-500">
        {entry.time}
      </div>

      <div className="relative flex justify-center">
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
        {!isLast ? (
          <span className="absolute top-5 h-[calc(100%-0.75rem)] w-px bg-border" />
        ) : null}
      </div>

      <div className="pb-4 text-sm text-slate-200">{entry.label}</div>
    </div>
  )
}

export default SignalTimelineItem
