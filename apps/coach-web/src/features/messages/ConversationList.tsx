import { Avatar } from '../../components/ui/Avatar'
import { conversationTitle, previewLine } from '../../lib/conversations'
import type { Conversation } from '../../lib/types'

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days < 1 || (days === 1 && new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString())) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Inbox pane: "New message" on top, then every conversation. */
export function ConversationList({ conversations, selectedId, meId, onSelect, onCompose }: {
  conversations: Conversation[]; selectedId: string | null; meId: string
  onSelect: (threadId: string) => void; onCompose: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-lg font-bold">Messages</p>
        <button onClick={onCompose} className="rounded-[10px] px-2.5 py-1.5 text-sm font-semibold text-accent hover:bg-surface2">✎ New message</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && <p className="p-4 text-sm text-text-faint">No conversations yet.</p>}
        {conversations.map((c) => {
          const title = conversationTitle(c)
          const first = c.members[0]
          return (
            <button key={c.thread_id} onClick={() => onSelect(c.thread_id)}
              aria-label={c.unread > 0 ? `${title}, ${c.unread} unread` : title}
              aria-current={selectedId === c.thread_id ? 'true' : undefined}
              className={`mb-0.5 flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition ${selectedId === c.thread_id ? 'bg-surface2 ring-1 ring-line' : 'hover:bg-surface2/50'}`}>
              <Avatar initials={first?.initials ?? '·'} url={first?.avatar_url} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${c.unread ? 'font-bold text-text' : 'font-semibold text-text'}`}>{title}</span>
                  <span className="shrink-0 text-[11px] text-text-faint">{timeLabel(c.last_at)}</span>
                </span>
                <span className={`block truncate text-xs ${c.unread ? 'text-text' : 'text-text-mute'}`}>{previewLine(c, meId)}</span>
              </span>
              {c.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
