import type { MockIncidentTimelineEntry } from './mockIncidents'

type SignalTimelineItemProps = {
  entry: MockIncidentTimelineEntry
  isLast: boolean
}

function SignalTimelineItem({ entry, isLast }: SignalTimelineItemProps) {
  return (
    <div className="grid grid-cols-[42px_14px_1fr] gap-2">
      <div className="pt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
        {entry.time}
      </div>

      <div className="relative flex justify-center">
        <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
        {!isLast ? (
          <span className="absolute top-4 h-[calc(100%-0.5rem)] w-px bg-border" />
        ) : null}
      </div>

      <div className="pb-3 text-[11px] leading-5 text-slate-200">{entry.label}</div>
    </div>
  )
}

export default SignalTimelineItem
