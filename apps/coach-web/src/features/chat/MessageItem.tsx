import type { Message, RunCard, AdjustCard } from '../../lib/types'

function timeLabel(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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

/** One message row. `mine` = sent by the signed-in coach (right-aligned, lime). */
export function MessageItem({ m, mine }: { m: Message; mine: boolean }) {
  const align = mine ? 'items-end' : 'items-start'
  return (
    <div className={`flex flex-col gap-0.5 ${align}`}>
      {m.kind === 'text' ? (
        <div className={`max-w-[85%] rounded-[14px] px-3 py-2 text-sm ${mine ? 'bg-accent text-on-accent' : 'bg-surface2 text-text'}`}>{m.body}</div>
      ) : m.kind === 'runcard' ? (
        <RunCardView p={m.payload as RunCard} />
      ) : (
        <AdjustCardView p={m.payload as AdjustCard} />
      )}
      <span className="px-1 text-[10px] text-text-faint">{timeLabel(m.created_at)}</span>
    </div>
  )
}
