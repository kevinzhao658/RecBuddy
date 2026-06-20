import type { Plan, Profile, Workout } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { Avatar } from '../../components/ui/Avatar'
import { fmtDur } from '../../lib/fmtDur'

export function TopBar({ athlete, plan, week }: { athlete: Profile; plan: Plan | null; week: (Workout | null)[] }) {
  const present = week.filter(Boolean) as Workout[]
  const miles = present.reduce((s, w) => s + (w.dist ?? 0), 0)
  const minutes = present.reduce((s, w) => s + estMinutes(w), 0)
  const done = present.filter((w) => w.status === 'done').length
  return (
    <header className="flex items-center gap-4 border-b border-line px-6 py-4">
      <Avatar initials={athlete.initials} className="h-12 w-12 text-base ring-1 ring-line" />
      <div className="flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Coach view</p>
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight">{athlete.name}</h2>
        {plan && <p className="text-sm text-text-mute">{plan.goal_race} · {plan.goal_date} · Week {plan.plan_week} of {plan.plan_weeks}</p>}
      </div>
      <div className="flex gap-8 text-right">
        <Stat label="Est. weekly vol." value={`${miles.toFixed(1)} mi`} />
        <Stat label="Time on feet" value={fmtDur(minutes)} />
        <Stat label="Completed" value={`${done}/${present.length}`} />
      </div>
    </header>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-mute">{label}</div><div className="font-num text-[20px] font-bold tabular-nums text-text">{value}</div></div>
}
