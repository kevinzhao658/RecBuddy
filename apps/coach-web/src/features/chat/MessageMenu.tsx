import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { REACTIONS, type ReactionSummary } from '../../lib/reactions'
import type { ReactionKind } from '../../lib/types'
import { MenuIcon, type MenuIconName } from '../../components/ui/Icon'
import { focusLayout, type Point, type Rect } from './focusLayout'

export type MessageAction = {
  key: string
  label: string
  icon?: MenuIconName
  /** Shown briefly after a successful click, e.g. "Copied"; the menu then closes. */
  doneLabel?: string
  /** Red, like iOS's destructive role (Block). */
  destructive?: boolean
  /** A divider above this item (sets off Report / Block). */
  separated?: boolean
  onClick: () => void | Promise<void>
}

/** The bubble's visible box: the union of its children (the column itself is full width). */
function contentRect(el: HTMLElement): Rect {
  const kids = Array.from(el.children).map((c) => c.getBoundingClientRect())
  if (!kids.length) { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } }
  const left = Math.min(...kids.map((r) => r.left)), right = Math.max(...kids.map((r) => r.right))
  const top = Math.min(...kids.map((r) => r.top)), bottom = Math.max(...kids.map((r) => r.bottom))
  return { left, top, width: right - left, height: bottom - top }
}

/** iOS-style focus on a held message: the thread dims and blurs, the bubble
 *  lifts out with a small pop, the emoji row sits above it and the menu below.
 *  `source` is the bubble column; the lifted bubble is a copy of it. */
export function MessageMenu({ source, actions, reactions = [], onReact, mine, focusFirst, onClose }: {
  source: HTMLElement
  actions: MessageAction[]
  /** Used reactions on this message (summarize output); mine are marked. */
  reactions?: ReactionSummary[]
  onReact?: (kind: ReactionKind) => void
  mine: boolean
  /** Opened from the keyboard: put focus on the first item. */
  focusFirst?: boolean
  onClose: () => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<{ box: Rect; origin: string; dy: number; palette: Point | null; menu: Point } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const mineReactions = reactions.filter((r) => r.mine)

  useLayoutEffect(() => {
    const preview = previewRef.current, menu = menuRef.current
    if (!preview || !menu) return
    const r = source.getBoundingClientRect()
    const box = { left: r.left, top: r.top, width: r.width, height: r.height }
    const content = contentRect(source)
    const copy = source.cloneNode(true) as HTMLElement
    copy.removeAttribute('id'); copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
    copy.style.visibility = 'visible'
    copy.setAttribute('inert', '')
    preview.replaceChildren(copy)
    const size = (el: HTMLElement | null) => el ? { width: el.offsetWidth, height: el.offsetHeight } : null
    const layout = focusLayout({ content, palette: size(paletteRef.current), menu: size(menu)!, viewport: { width: window.innerWidth, height: window.innerHeight }, mine })
    // Pop from the bubble's open edge, the way iOS lifts it.
    const origin = `${(mine ? content.left + content.width : content.left) - box.left}px ${content.top + content.height / 2 - box.top}px`
    setFrame({ box, origin, ...layout })
  }, [source, mine])

  useEffect(() => {
    if (focusFirst) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [focusFirst])
  useEffect(() => {
    window.addEventListener('resize', onClose)
    return () => window.removeEventListener('resize', onClose)
  }, [onClose])

  const run = async (a: MessageAction) => {
    setFailed(null)
    if (!a.doneLabel) { onClose(); await a.onClick(); return }
    try {
      await a.onClick()
      setDone(a.key); setTimeout(onClose, 700)
    } catch {
      setFailed(a.key)
    }
  }
  const react = (k: ReactionKind) => { onClose(); onReact?.(k) }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Tab') return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (!items.length) return
    e.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLElement)
    const back = e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)
    items[(at + (back ? -1 : 1) + items.length) % items.length].focus()
  }

  const place = (p: Point | null | undefined): CSSProperties =>
    p ? { left: p.left, top: p.top } : { left: 0, top: 0, visibility: 'hidden' }
  const lift = frame ? `translateY(${frame.dy}px) scale(1.02)` : undefined

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div data-testid="message-focus-backdrop" aria-hidden onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[6px] motion-safe:animate-rb-fade" />
      <div ref={previewRef} data-testid="message-focus-preview" aria-hidden
        style={frame ? { left: frame.box.left, top: frame.box.top, width: frame.box.width, height: frame.box.height,
          transformOrigin: frame.origin, transform: lift, ['--rb-dy' as string]: `${frame.dy}px` } : { visibility: 'hidden' }}
        className="pointer-events-none absolute drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)] motion-safe:animate-rb-pop" />
      {onReact && (
        <div ref={paletteRef} role="group" aria-label="Reactions" style={place(frame?.palette)}
          className={`absolute flex gap-0.5 rounded-full border border-line bg-surface2 p-1 shadow-xl motion-safe:animate-rb-menu
            ${mine ? 'origin-bottom-right' : 'origin-bottom-left'}`}>
          {REACTIONS.map((r) => {
            const on = mineReactions.some((m) => m.kind === r.kind)
            return (
              <button key={r.kind} type="button" onClick={() => react(r.kind)} aria-label={r.label} aria-pressed={on} title={r.label}
                className={`grid h-10 w-10 place-items-center rounded-full text-xl transition hover:scale-110 hover:bg-surface
                  ${on ? 'bg-accent/20 ring-1 ring-accent' : ''}`}>
                <span aria-hidden>{r.emoji}</span>
              </button>
            )
          })}
        </div>
      )}
      <div ref={menuRef} role="menu" aria-label="Message actions" style={place(frame?.menu)}
        className={`absolute w-60 overflow-hidden rounded-[14px] border border-line bg-surface2 py-1 shadow-2xl motion-safe:animate-rb-menu
          ${mine ? 'origin-top-right' : 'origin-top-left'}`}>
        {onReact && mineReactions.map((r) => (
          <MenuItem key={`rm-${r.kind}`} label={`Remove ${r.emoji}`} icon="remove" onClick={() => react(r.kind)} />
        ))}
        {actions.map((a, i) => (
          <div key={a.key}>
            {a.separated && (i > 0 || mineReactions.length > 0) && <div role="separator" className="my-1 h-px bg-line" />}
            <MenuItem label={done === a.key ? a.doneLabel! : failed === a.key ? 'Failed — try again' : a.label}
              icon={a.icon} destructive={a.destructive} onClick={() => run(a)} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

function MenuItem({ label, icon, destructive, onClick }: { label: string; icon?: MenuIconName; destructive?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm outline-none transition hover:bg-surface focus-visible:bg-surface
        ${destructive ? 'text-missed' : 'text-text'}`}>
      <span className="truncate">{label}</span>
      {icon && <MenuIcon name={icon} className={destructive ? '' : 'text-text-mute'} />}
    </button>
  )
}
