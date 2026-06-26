import type { Workout } from '../../lib/types'
import { monthOf } from '../../lib/week'
import { Stat } from '../../components/ui/Stat'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'

/** Month totals (in-month days only): scheduled vs completed mileage + adherence. */
export function MonthStats({ byDate, anchor }: { byDate: Record<string, Workout>; anchor: string }) {
  const { unit } = useUnit()
  const m = monthOf(anchor)
  const ws = Object.values(byDate).filter((w) => monthOf(w.date) === m)
  const scheduled = ws.reduce((s, w) => s + (w.dist ?? 0), 0)
  const completed = ws.filter((w) => w.status === 'done').reduce((s, w) => s + (w.dist ?? 0), 0)
  const adherence = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
  return (
    <div className="flex gap-7 text-right">
      <Stat label="Scheduled" value={`${Math.round(fromMiles(scheduled, unit))} ${unit}`} />
      <Stat label="Completed" value={`${Math.round(fromMiles(completed, unit))} ${unit}`} />
      <Stat label="Adherence" value={`${adherence}%`} />
    </div>
  )
}
