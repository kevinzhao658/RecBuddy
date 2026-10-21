import { forwardRef, useState, type CSSProperties } from 'react'

export type MessageAction = {
  key: string
  label: string
  /** Shown briefly after a successful click, e.g. "Copied". */
  doneLabel?: string
  onClick: () => void | Promise<void>
}

type Box = { left: number; right: number; top: number; height: number }
const GAP = 8

/** Where the action bar goes, in px relative to the message wrapper: just
 *  beside the bubble on its open side (right of theirs, left of mine), centred
 *  on it; when the bubble is too wide for that, over its top edge instead. */
export function actionBarPosition({ wrapperWidth, bubble, bar, mine }: {
  wrapperWidth: number; bubble: Box; bar: { width: number; height: number }; mine: boolean
}): { left: number; top: number } {
  const beside = mine ? bubble.left - GAP - bar.width : bubble.right + GAP
  if (beside >= 0 && beside + bar.width <= wrapperWidth) {
    return { left: beside, top: bubble.top + (bubble.height - bar.height) / 2 }
  }
  const over = mine ? bubble.left : bubble.right - bar.width
  return { left: Math.max(0, Math.min(over, wrapperWidth - bar.width)), top: bubble.top - 12 }
}

/** Small action bar next to a message: appears on hover, keyboard focus, or a
 *  right-click / long-press (open). The parent places it via `style`. */
export const MessageActions = forwardRef<HTMLDivElement, {
  actions: MessageAction[]; open: boolean; style?: CSSProperties
}>(function MessageActions({ actions, open, style }, ref) {
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
    <div ref={ref} role="toolbar" aria-label="Message actions" style={style}
      className={`absolute left-0 top-0 z-10 flex w-max gap-0.5 rounded-full border border-line bg-surface2 p-0.5 shadow-lg transition-opacity
        ${open ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100'}`}>
      {actions.map((a) => (
        <button key={a.key} type="button" onClick={() => run(a)}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-text-mute hover:bg-surface hover:text-text">
          {done === a.key ? a.doneLabel : failed === a.key ? 'Failed' : a.label}
        </button>
      ))}
    </div>
  )
})
