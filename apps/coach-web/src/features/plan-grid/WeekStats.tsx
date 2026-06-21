import type { Workout } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'

/** The week's projected volume / time-on-feet / completion, shown in the controls row. */
export function WeekStats({ week }: { week: (Workout | null)[] }) {
  const present = week.filter(Boolean) as Workout[]
  const miles = present.reduce((s, w) => s + (w.dist ?? 0), 0)
  const minutes = present.reduce((s, w) => s + estMinutes(w), 0)
  const done = present.filter((w) => w.status === 'done').length
  return (
    <div className="flex gap-7 text-right">
      <Stat label="Est. weekly vol." value={`${miles.toFixed(1)} mi`} />
      <Stat label="Time on feet" value={fmtDur(minutes)} />
      <Stat label="Completed" value={`${done}/${present.length}`} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-mute">{label}</div>
      <div className="font-num text-[19px] font-bold tabular-nums text-text">{value}</div>
    </div>
  )
}
