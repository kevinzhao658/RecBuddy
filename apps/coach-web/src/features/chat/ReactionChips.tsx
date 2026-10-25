import { REACTIONS, type ReactionSummary } from '../../lib/reactions'
import type { ReactionKind } from '../../lib/types'

/** Slack-style chips under a message: used reactions always (with counts),
 *  all five while the message is hovered or focused. Clicking toggles yours.
 *  Without onToggle (read-only chats) they're view-only labels. */
export function ReactionChips({ items, onToggle, showAll }: {
  items: ReactionSummary[]; onToggle?: (kind: ReactionKind) => void; showAll: boolean
}) {
  const chips = showAll && onToggle
    ? REACTIONS.map((r) => items.find((i) => i.kind === r.kind) ?? { ...r, count: 0, mine: false, names: [] as string[] })
    : items
  if (!chips.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c) => !onToggle ? (
        <span key={c.kind} role="img" aria-label={`${c.label}, ${c.count}: ${c.names.join(', ')}`} title={c.names.join(', ')}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs
            ${c.mine ? 'border-accent bg-accent/10 text-text' : 'border-line bg-surface2 text-text-mute'}`}>
          <span aria-hidden>{c.emoji}</span>
          <span className="font-num" aria-hidden>{c.count}</span>
        </span>
      ) : (
        <button key={c.kind} type="button" onClick={() => onToggle(c.kind)}
          aria-pressed={c.mine}
          aria-label={c.count ? `${c.label}, ${c.count}: ${c.names.join(', ')}` : c.label}
          title={c.count ? c.names.join(', ') : c.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition
            ${c.mine ? 'border-accent bg-accent/10 text-text' : 'border-line bg-surface2 text-text-mute hover:border-text-mute'}
            ${c.count ? '' : 'opacity-60'}`}>
          <span aria-hidden>{c.emoji}</span>
          {c.count > 0 && <span className="font-num">{c.count}</span>}
        </button>
      ))}
    </div>
  )
}
