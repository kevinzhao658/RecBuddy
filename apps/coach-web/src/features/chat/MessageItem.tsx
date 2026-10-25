import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Message, RunCard, AdjustCard, WorkoutCard, ImageCard, WorkoutQuote } from '../../lib/types'
import { MessageMenu, type MessageAction } from './MessageMenu'
import { ReactionChips } from './ReactionChips'
import type { ReactionSummary } from '../../lib/reactions'
import type { ReactionKind } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { fmtDayDate } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'
import { useSignedImageUrl } from '../../lib/queries/chat'

export type Sender = { name: string; initials: string; avatarUrl?: string | null }
/** Quote above a reply. available=false: the original was deleted or hidden. */
export type Quote = { author: string; text: string; available: boolean; onClick?: () => void }

function QuoteView({ q }: { q: Quote }) {
  return (
    <button type="button" onClick={q.onClick} disabled={!q.onClick || !q.available}
      aria-label={q.available ? `Reply to ${q.author}: ${q.text}` : 'Reply to an unavailable message'}
      className="mb-0.5 flex max-w-[85%] gap-2 rounded-[10px] bg-surface/70 px-2.5 py-1.5 text-left transition enabled:hover:bg-surface">
      <span className={`w-[3px] shrink-0 rounded-full ${q.available ? 'bg-accent' : 'bg-text-faint'}`} aria-hidden />
      <span className="min-w-0">
        {q.available && <span className="block text-[11px] font-bold text-accent">{q.author}</span>}
        <span className={`line-clamp-2 text-xs text-text-mute ${q.available ? '' : 'italic'}`}>
          {q.available ? q.text : 'Original message unavailable'}
        </span>
      </span>
    </button>
  )
}

function WorkoutChip({ p, onOpen }: { p: WorkoutQuote; onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} disabled={!onOpen}
      className="mb-0.5 flex max-w-[85%] items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-text transition enabled:hover:border-text-mute">
      <TypeIcon type={p.type} className="shrink-0 text-accent" />
      <span className="truncate">{p.title} · {fmtDayDate(p.date)}</span>
      {onOpen && <span className="text-text-faint" aria-hidden>›</span>}
    </button>
  )
}

function WorkoutCardView({ p, onOpen }: { p: WorkoutCard; onOpen?: () => void }) {
  const { unit } = useUnit()
  return (
    <button onClick={onOpen} disabled={!onOpen}
      className="rb-card rb-card-sm flex w-full max-w-[85%] items-center gap-2 p-3 text-left transition enabled:hover:border-text-mute">
      <TypeIcon type={p.type} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">Workout · {fmtDayDate(p.date)}</p>
        <p className="truncate font-semibold">{p.title}</p>
        {p.dist != null && <p className="font-num text-xs text-text-mute">{fmtDist(p.dist, unit)} {unit} · {fmtPace(p.pace, unit)}</p>}
      </div>
      {onOpen && <span className="text-text-faint" aria-hidden>›</span>}
    </button>
  )
}

function RunCardView({ p, onOpen }: { p: RunCard; onOpen?: () => void }) {
  // New shares carry the workout's date -> the card opens that day's
  // results-vs-plan view; legacy runcards (no date) stay static.
  return (
    <button onClick={onOpen} disabled={!onOpen}
      className="rb-card rb-card-sm flex w-full max-w-[85%] items-start gap-2 p-3 text-left transition enabled:hover:border-text-mute">
      {p.type && <TypeIcon type={p.type} className="mt-0.5 shrink-0 text-accent" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          Logged run{p.date ? ` · ${fmtDayDate(p.date)}` : ''}
        </p>
        <p className="mt-0.5 font-semibold">{p.title}</p>
        <div className="mt-2.5 grid grid-cols-3 gap-4 font-num text-xs text-text-mute">
          <span><span className="mb-0.5 block text-[10px] uppercase text-text-faint">Dist</span>{p.dist}</span>
          <span><span className="mb-0.5 block text-[10px] uppercase text-text-faint">Pace</span>{p.pace}</span>
          <span><span className="mb-0.5 block text-[10px] uppercase text-text-faint">Time</span>{p.time}</span>
        </div>
        {p.hr != null && <p className="mt-2.5 font-num text-xs text-text-faint">Avg HR {p.hr}</p>}
        {p.note && <p className="mt-2.5 text-xs text-text-mute">“{p.note}”</p>}
      </div>
      {onOpen && <span className="text-text-faint" aria-hidden>›</span>}
    </button>
  )
}

function ImageView({ p }: { p: ImageCard }) {
  // New canonical flow: exchange the stored path for a short-lived signed URL.
  const { data: signedUrl } = useSignedImageUrl(p.path ?? null)

  // Resolve the URL that is safe to put in href/src:
  //   - path-based (new): use signed URL once available, else show placeholder
  //   - legacy url: only accept a strict https:// scheme — reject javascript: and data: etc.
  let href: string | null = null
  if (p.path) {
    href = signedUrl ?? null
  } else if (typeof p.url === 'string' && /^https:\/\//i.test(p.url)) {
    href = p.url
  }

  const aspectStyle = p.w && p.h ? { aspectRatio: `${p.w}/${p.h}` } as const : undefined

  // Show a placeholder while a path-based signed URL is still loading.
  if (p.path && !href) {
    return (
      <div
        style={aspectStyle}
        className="block max-w-[70%] rounded-[14px] bg-surface2"
      />
    )
  }

  // No valid href (unsafe legacy scheme or empty payload) — render nothing.
  if (!href) return null

  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      <img
        src={href}
        alt="Chat image"
        loading="lazy"
        style={aspectStyle}
        className="block max-w-[70%] rounded-[14px]"
      />
    </a>
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
 *  `grouped` tightens same-sender stacking. Timestamps live in the centered
 *  session separators rendered by ThreadView, not per message. */
const HOLD_MS = 450

export function MessageItem({ m, mine, sender, showName, showAvatar, grouped, superseded, domId, onJumpToLatest, onOpenWorkout, actions = [], quote, highlighted, reactions = [], onReact }: {
  m: Message; mine: boolean; sender?: Sender; showName?: boolean; showAvatar?: boolean
  grouped?: boolean; superseded?: boolean; domId?: string
  onJumpToLatest?: () => void; onOpenWorkout?: (date: string, workoutId?: string) => void
  /** Reply / Copy / Report … — the press-and-hold menu. */
  actions?: MessageAction[]
  quote?: Quote
  /** Briefly true after jumping here from a reply quote. */
  highlighted?: boolean
  /** Used reactions (summarize output) and the toggle; chips sit under the bubble. */
  reactions?: ReactionSummary[]
  onReact?: (kind: ReactionKind) => void
}) {
  // The open menu and the bubble it lifts; 'keyboard' puts focus on its first item.
  const [menu, setMenu] = useState<null | { by: 'pointer' | 'keyboard'; source: HTMLElement }>(null)
  const openMenu = (by: 'pointer' | 'keyboard') => { if (bubbleRef.current) setMenu({ by, source: bubbleRef.current }) }
  const menuOpen = menu !== null
  const closeMenu = useCallback(() => setMenu(null), [])
  const [hovered, setHovered] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLButtonElement>(null)
  // Press and hold (mouse or touch) opens the menu; a quick click doesn't. The
  // bubble sinks a little while held, then pops out into focus.
  const [pressing, setPressing] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancelHold = () => { clearTimeout(holdTimer.current); setPressing(false) }
  useLayoutEffect(() => () => clearTimeout(holdTimer.current), [])
  const [focused, setFocused] = useState(false)
  const chips = !superseded && (onReact || reactions.length)
    ? <ReactionChips items={reactions} onToggle={onReact} showAll={!menuOpen && (hovered || focused)} />
    : null
  // A newer card for the same workout exists below — roll this one up into a
  // compact placeholder that jumps the chat to that newest card.
  const body = superseded ? (
    <button onClick={onJumpToLatest} disabled={!onJumpToLatest}
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs text-text-faint transition enabled:hover:text-text-mute">
      <span aria-hidden>↓</span>
      {(m.payload as RunCard | WorkoutCard)?.title ?? 'Workout'} · {m.kind === 'runcard' ? 'log updated below' : 're-shared below'}
    </button>
  ) : m.kind === 'text' ? (
    <>
      {(m.payload as WorkoutQuote | null)?.quote === 'workout' && (
        <WorkoutChip p={m.payload as WorkoutQuote}
          onOpen={onOpenWorkout ? () => onOpenWorkout((m.payload as WorkoutQuote).date, m.workout_id ?? undefined) : undefined} />
      )}
      <div className={`max-w-[85%] rounded-[14px] px-3 py-2 text-sm ${mine ? 'bg-accent text-on-accent' : 'bg-surface2 text-text'}`}>{m.body}</div>
    </>
  ) : m.kind === 'runcard' ? (
    <RunCardView p={m.payload as RunCard}
      onOpen={onOpenWorkout && (m.payload as RunCard).date ? () => onOpenWorkout((m.payload as RunCard).date!, m.workout_id ?? undefined) : undefined} />
  ) : m.kind === 'workout' ? (
    <WorkoutCardView p={m.payload as WorkoutCard} onOpen={onOpenWorkout ? () => onOpenWorkout((m.payload as WorkoutCard).date, m.workout_id ?? undefined) : undefined} />
  ) : m.kind === 'image' ? (
    <div className={`flex max-w-[85%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <ImageView p={m.payload as ImageCard} />
      {m.body && <div className={`rounded-[14px] px-3 py-2 text-sm ${mine ? 'bg-accent text-on-accent' : 'bg-surface2 text-text'}`}>{m.body}</div>}
    </div>
  ) : (
    <AdjustCardView p={m.payload as AdjustCard} />
  )

  // Bubble + its press-and-hold menu. Holding the message opens it; Escape or
  // a click outside closes it.
  const withActions = actions.length && !superseded ? (
    <div className={`group/msg relative flex w-full flex-col ${mine ? 'items-end' : 'items-start'}`}
      data-pressing={pressing || undefined}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // React bubbles events up from the menu's portal; only the message itself counts.
        if (e.button !== 0 || menuOpen || !e.currentTarget.contains(e.target as Node)) return
        cancelHold(); setPressing(true)
        holdTimer.current = setTimeout(() => { setPressing(false); openMenu('pointer') }, HOLD_MS)
      }}
      onPointerUp={cancelHold} onPointerCancel={cancelHold}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { cancelHold(); setHovered(false) }}
      // Keyboard: tabbing into the message reveals every reaction and the options button.
      onFocus={(e) => { if (e.currentTarget.contains(e.target as Node)) setFocused(true) }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}>
      <button ref={optionsRef} type="button" aria-label="Message options" onClick={() => openMenu('keyboard')}
        className={`sr-only focus:not-sr-only focus:absolute focus:top-0 focus:z-10 focus:rounded-full focus:border focus:border-line focus:bg-surface2 focus:px-2.5 focus:py-1 focus:text-xs focus:text-text
          ${mine ? 'focus:left-0' : 'focus:right-0'}`}>•••</button>
      {quote && !superseded && <QuoteView q={quote} />}
      <div ref={bubbleRef}
        style={menuOpen ? { visibility: 'hidden' } : undefined}
        className={`flex w-full flex-col transition-transform duration-[450ms] ease-out motion-reduce:transition-none ${mine ? 'items-end origin-right' : 'items-start origin-left'} ${pressing ? 'scale-[0.97]' : ''}`}>{body}</div>
      {chips}
      {menu && (
        <MessageMenu source={menu.source} actions={actions} reactions={reactions} onReact={onReact} mine={mine}
          focusFirst={menu.by === 'keyboard'}
          onClose={() => { const back = menu.by === 'keyboard'; closeMenu(); if (back) optionsRef.current?.focus() }} />
      )}
    </div>
  ) : (
    <>
      {quote && !superseded && <QuoteView q={quote} />}
      {body}
    </>
  )
  const flash = highlighted ? 'rounded-[12px] bg-accent/15' : 'bg-transparent'

  if (mine) {
    return <div id={domId} className={`flex flex-col items-end transition-colors duration-300 ${flash} ${grouped ? 'mt-0.5' : 'mt-3'}`}>{withActions}</div>
  }
  return (
    <div id={domId} className={`flex items-end gap-2 transition-colors duration-300 ${flash} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
      <div className="w-5 shrink-0">{showAvatar && sender && <Avatar initials={sender.initials} url={sender.avatarUrl} size="sm" />}</div>
      {/* flex-1 so bubbles wrap at 85% of the panel — without it the column
          shrink-wraps and short multi-word messages break one word per line */}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        {showName && sender && <span className="mb-0.5 px-0.5 text-[11px] font-semibold text-text-mute">{sender.name}</span>}
        {withActions}
      </div>
    </div>
  )
}
