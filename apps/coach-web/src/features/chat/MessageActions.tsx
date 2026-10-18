import { useState } from 'react'

export type MessageAction = {
  key: string
  label: string
  /** Shown briefly after a successful click, e.g. "Copied". */
  doneLabel?: string
  onClick: () => void | Promise<void>
}

/** Small action bar on the empty side of a message (right of theirs, left of
 *  mine) so it never covers names or cards: appears on hover, keyboard focus, or a
 *  right-click / long-press (open). */
export function MessageActions({ actions, mine, open }: { actions: MessageAction[]; mine: boolean; open: boolean }) {
  const [done, setDone] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  if (!actions.length) return null
  const run = async (a: MessageAction) => {
    setFailed(null)
    try {
      await a.onClick()
      if (a.doneLabel) { setDone(a.key); setTimeout(() => setDone(null), 1500) }
    } catch {
      setFailed(a.key); setTimeout(() => setFailed(null), 2000)
    }
  }
  return (
    <div role="toolbar" aria-label="Message actions"
      className={`absolute -top-3 z-10 flex gap-0.5 rounded-full border border-line bg-surface2 p-0.5 shadow-lg transition-opacity
        ${mine ? 'left-1' : 'right-1'}
        ${open ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100'}`}>
      {actions.map((a) => (
        <button key={a.key} type="button" onClick={() => run(a)}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-text-mute hover:bg-surface hover:text-text">
          {done === a.key ? a.doneLabel : failed === a.key ? 'Failed' : a.label}
        </button>
      ))}
    </div>
  )
}
