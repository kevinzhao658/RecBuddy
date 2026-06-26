import { Fragment, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useThread, useMessages, useSendMessage, useMarkThreadRead, useRealtimeThread } from '../../lib/queries/chat'
import { useTeam } from '../../lib/queries/team'
import { MessageItem, type Sender } from './MessageItem'

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

// A new "session" header is shown when the chat went quiet for over two hours
// (or it's a new day) — otherwise messages flow without timestamps.
const SESSION_GAP_MS = 2 * 60 * 60 * 1000
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
function sessionLabel(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return `Today ${time}`
  if (sameDay(d, yest)) return `Yesterday ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

export function ChatPanel({ athleteId, athleteName, onClose, onOpenDay }: {
  athleteId: string; athleteName: string; onClose: () => void; onOpenDay?: (date: string) => void
}) {
  const { session } = useAuth()
  const meId = session!.user.id
  const threadQ = useThread(athleteId)
  const threadId = threadQ.data?.id ?? null
  const messagesQ = useMessages(threadId)
  const send = useSendMessage(threadId)
  const markRead = useMarkThreadRead(threadId)
  useRealtimeThread(threadId)

  const team = useTeam(athleteId)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = messagesQ.data ?? []

  // Resolve each from_user_id → name/initials: every coach on the team + the athlete.
  const senders: Record<string, Sender> = { [athleteId]: { name: athleteName, initials: initialsOf(athleteName) } }
  for (const m of team.data ?? []) senders[m.coach_id] = { name: m.coach.name, initials: m.coach.initials }

  // Mark the athlete's unread messages read once the thread opens.
  useEffect(() => { if (threadId) markRead.mutate(meId) }, [threadId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the latest message in view.
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight }) }, [messages.length])

  const submit = () => {
    const body = text.trim()
    if (!body || !threadId) return
    send.mutate(body)
    setText('')
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="rb-surface absolute right-0 top-0 flex h-screen w-[400px] flex-col border-l border-line shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Messages</p>
            <p className="font-display text-lg font-bold leading-tight">{athleteName}</p>
          </div>
          <button aria-label="Close chat" onClick={onClose} className="text-text-faint hover:text-text">✕</button>
        </header>

        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto p-4">
          {messagesQ.isLoading && <p className="text-sm text-text-faint">Loading…</p>}
          {!messagesQ.isLoading && messages.length === 0 && (
            <p className="m-auto max-w-[80%] text-center text-sm text-text-faint">No messages yet. Say hello to {athleteName.split(' ')[0]}.</p>
          )}
          {messages.map((m, i) => {
            // A separator (new session) breaks the flow at a > 1h gap or a new day.
            const sepBefore = (idx: number) => {
              if (idx === 0) return true
              const gap = new Date(messages[idx].created_at).getTime() - new Date(messages[idx - 1].created_at).getTime()
              return gap > SESSION_GAP_MS || !sameDay(new Date(messages[idx].created_at), new Date(messages[idx - 1].created_at))
            }
            // A block starts on a sender change or after a separator.
            const newBlock = (idx: number) => idx === 0 || messages[idx - 1].from_user_id !== messages[idx].from_user_id || sepBefore(idx)
            const sep = sepBefore(i)
            const startsBlock = newBlock(i)
            const showAvatar = i === messages.length - 1 || newBlock(i + 1)
            return (
              <Fragment key={m.id}>
                {sep && <div className="my-3 text-center text-[11px] text-text-faint">{sessionLabel(m.created_at)}</div>}
                <MessageItem m={m} mine={m.from_user_id === meId}
                  sender={senders[m.from_user_id] ?? { name: 'Coach', initials: '·' }}
                  showName={startsBlock} showAvatar={showAvatar} grouped={!startsBlock}
                  onOpenWorkout={onOpenDay} />
              </Fragment>
            )
          })}
        </div>

        <div className="flex items-end gap-2 border-t border-line p-3">
          <textarea aria-label="Message" value={text} rows={1} placeholder={`Message ${athleteName.split(' ')[0]}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            className="max-h-28 flex-1 resize-none rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
          <button aria-label="Send message" onClick={submit} disabled={!text.trim() || send.isPending}
            className="rb-glow rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">Send</button>
        </div>
      </aside>
    </div>
  )
}
