import type { Message, RunCard, AdjustCard, WorkoutCard } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { fmtShortDate } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'

export type Sender = { name: string; initials: string }

function timeLabel(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function WorkoutCardView({ p, onOpen }: { p: WorkoutCard; onOpen?: () => void }) {
  const { unit } = useUnit()
  return (
    <button onClick={onOpen} disabled={!onOpen}
      className="rb-card rb-card-sm flex w-full max-w-[85%] items-center gap-2 p-3 text-left transition enabled:hover:border-text-mute">
      <TypeIcon type={p.type} className="shrink-0 text-text-mute" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Workout · {fmtShortDate(p.date)}</p>
        <p className="truncate font-semibold">{p.title}</p>
        {p.dist != null && <p className="font-num text-xs text-text-mute">{fmtDist(p.dist, unit)} {unit} · {fmtPace(p.pace, unit)}</p>}
      </div>
      {onOpen && <span className="text-text-faint" aria-hidden>›</span>}
    </button>
  )
}

function RunCardView({ p }: { p: RunCard }) {
  return (
    <div className="rb-card rb-card-sm w-full max-w-[85%] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Logged run</p>
      <p className="mt-0.5 font-semibold">{p.title}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2 font-num text-xs text-text-mute">
        <span><span className="block text-[10px] uppercase text-text-faint">Dist</span>{p.dist}</span>
        <span><span className="block text-[10px] uppercase text-text-faint">Pace</span>{p.pace}</span>
        <span><span className="block text-[10px] uppercase text-text-faint">Time</span>{p.time}</span>
      </div>
      {p.hr != null && <p className="mt-1.5 font-num text-xs text-text-faint">Avg HR {p.hr}</p>}
    </div>
  )
}

function AdjustCardView({ p }: { p: AdjustCard }) {
  return (
    <div className="rb-card rb-card-sm w-full max-w-[85%] border-l-2 border-accent p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Workout adjusted</p>
      <p className="mt-1 font-num text-sm text-text-mute"><span className="line-through opacity-60">{p.from}</span> → <span className="text-text">{p.to}</span></p>
      {p.reason && <p className="mt-1 text-xs text-text-faint">{p.reason}</p>}
    </div>
  )
}

/** One message row.
 *  - `mine` (signed-in coach): right-aligned lime bubble, no avatar/name.
 *  - others: avatar to the LEFT (on the last message of a run) + name ABOVE
 *    (on the first), so co-coaches and the athlete are distinguishable.
 *  `grouped` tightens same-sender stacking; `showTime` shows the timestamp only
 *  at the end of a same-minute run. */
export function MessageItem({ m, mine, sender, showName, showAvatar, grouped, showTime = true, onOpenWorkout }: {
  m: Message; mine: boolean; sender?: Sender; showName?: boolean; showAvatar?: boolean
  grouped?: boolean; showTime?: boolean; onOpenWorkout?: (date: string) => void
}) {
  const body = m.kind === 'text' ? (
    <div className={`max-w-[85%] rounded-[14px] px-3 py-2 text-sm ${mine ? 'bg-accent text-on-accent' : 'bg-surface2 text-text'}`}>{m.body}</div>
  ) : m.kind === 'runcard' ? (
    <RunCardView p={m.payload as RunCard} />
  ) : m.kind === 'workout' ? (
    <WorkoutCardView p={m.payload as WorkoutCard} onOpen={onOpenWorkout ? () => onOpenWorkout((m.payload as WorkoutCard).date) : undefined} />
  ) : (
    <AdjustCardView p={m.payload as AdjustCard} />
  )
  const time = showTime ? <span className="px-1 text-[10px] text-text-faint">{timeLabel(m.created_at)}</span> : null

  if (mine) {
    return (
      <div className={`flex flex-col items-end ${grouped ? 'mt-0.5' : 'mt-3'}`}>{body}{time}</div>
    )
  }
  return (
    <div className={`flex items-end gap-2 ${grouped ? 'mt-0.5' : 'mt-3'}`}>
      <div className="w-5 shrink-0">{showAvatar && sender && <Avatar initials={sender.initials} size="sm" />}</div>
      <div className="flex min-w-0 flex-col items-start">
        {showName && sender && <span className="mb-0.5 px-0.5 text-[11px] font-semibold text-text-mute">{sender.name}</span>}
        {body}
        {time}
      </div>
    </div>
  )
}
