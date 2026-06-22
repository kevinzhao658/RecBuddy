import type { Workout } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'
import { Stat } from '../../components/ui/Stat'

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
