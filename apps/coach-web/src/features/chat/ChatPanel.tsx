import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useThread, useMessages, useSendMessage, useSendImages, useMarkThreadRead, useRealtimeThread } from '../../lib/queries/chat'
import { latestCardIds, supersededCardIds } from '../../lib/runcardRollup'
import { useTeam } from '../../lib/queries/team'
import { MessageItem, type Sender } from './MessageItem'

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

// A new "session" header is shown when the chat went quiet for over two hours
// (or it's a new day) — otherwise messages flow without timestamps.
const SESSION_GAP_MS = 2 * 60 * 60 * 1000
// Most photos stageable in the composer at once (matches the iOS picker cap).
const MAX_PHOTOS = 6
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

export function ChatPanel({ athleteId, athleteName, athleteAvatarUrl, onClose, onOpenDay }: {
  athleteId: string; athleteName: string; athleteAvatarUrl?: string | null
  onClose: () => void; onOpenDay?: (date: string) => void
}) {
  const { session } = useAuth()
  const meId = session!.user.id
  const threadQ = useThread(athleteId)
  const threadId = threadQ.data?.id ?? null
  const messagesQ = useMessages(threadId)
  const send = useSendMessage(threadId)
  const sendImages = useSendImages(threadId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const markRead = useMarkThreadRead(threadId)
  useRealtimeThread(threadId)

  const team = useTeam(athleteId)
  const [text, setText] = useState('')
  // Picked photos are STAGED here (with previews) so a caption can be added
  // before sending — nothing uploads until Send. Capped at MAX_PHOTOS.
  const [staged, setStaged] = useState<File[]>([])
  const stagedUrls = useMemo(() => staged.map((f) => URL.createObjectURL(f)), [staged])
  useEffect(() => () => { stagedUrls.forEach((u) => URL.revokeObjectURL(u)) }, [stagedUrls])
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = messagesQ.data ?? []
  // Re-shared cards for the same workout roll up into a placeholder that
  // jumps to the newest card.
  const superseded = useMemo(() => supersededCardIds(messages), [messages])
  const latestCards = useMemo(() => latestCardIds(messages), [messages])
  const jumpToMessage = (id: string) =>
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // Resolve each from_user_id → name/initials: every coach on the team + the athlete.
  const senders: Record<string, Sender> = { [athleteId]: { name: athleteName, initials: initialsOf(athleteName), avatarUrl: athleteAvatarUrl } }
  for (const m of team.data ?? []) senders[m.coach_id] = { name: m.coach.name, initials: m.coach.initials, avatarUrl: m.coach.avatar_url }

  // Mark the athlete's unread messages read once the thread opens.
  useEffect(() => { if (threadId) markRead.mutate(meId) }, [threadId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the latest message in view.
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight }) }, [messages.length])
  // Auto-grow the composer with line breaks, up to ~7rem (max-h-28), then scroll.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [text])

  const submit = () => {
    const body = text.trim()
    if (!threadId) return
    if (staged.length) {
      sendImages.mutate({ files: staged, body: body || undefined })
      setStaged([])
      setText('')
      return
    }
    if (!body) return
    send.mutate(body)
    setText('')
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="rb-surface absolute right-0 top-0 flex h-screen w-full flex-col border-l border-line shadow-2xl sm:w-[400px]">
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
                <MessageItem m={m} mine={m.from_user_id === meId} domId={`msg-${m.id}`}
                  sender={senders[m.from_user_id] ?? { name: 'Coach', initials: '·' }}
                  showName={startsBlock} showAvatar={showAvatar} grouped={!startsBlock}
                  superseded={superseded.has(m.id)}
                  onJumpToLatest={m.workout_id && latestCards.has(`${m.kind}:${m.workout_id}`)
                    ? () => jumpToMessage(latestCards.get(`${m.kind}:${m.workout_id}`)!)
                    : undefined}
                  onOpenWorkout={onOpenDay} />
              </Fragment>
            )
          })}
        </div>

        {/* Staged attachment previews — shown above the composer until sent/removed */}
        {staged.length > 0 && (
          <div className="border-t border-line px-3 pt-3">
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {stagedUrls.map((url, i) => (
                <div key={url} className="relative shrink-0">
                  <img src={url} alt={`Attached photo ${i + 1}`} className="h-16 w-16 rounded-[10px] object-cover" />
                  <button aria-label={`Remove attachment ${i + 1}`}
                    onClick={() => setStaged((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-surface2 text-xs text-text ring-1 ring-line hover:text-missed">✕</button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-faint">
              {staged.length === 1 ? 'Photo attached' : `${staged.length} photos attached`} — add a caption below, then Send.
            </p>
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-line p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) setStaged((prev) => [...prev, ...files].slice(0, MAX_PHOTOS))
              e.target.value = ''
            }}
          />
          <button
            aria-label="Attach photos"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendImages.isPending || staged.length >= MAX_PHOTOS}
            className="shrink-0 text-text-faint hover:text-text-mute disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={20} height={20} aria-hidden="true">
              <path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>
          <textarea ref={taRef} aria-label="Message" value={text} rows={1}
            placeholder={staged.length ? 'Add a caption…' : `Message ${athleteName.split(' ')[0]}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            className="max-h-28 flex-1 resize-none overflow-y-auto rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
          <button aria-label="Send message" onClick={submit} disabled={(!text.trim() && !staged.length) || send.isPending || sendImages.isPending}
            className="rb-glow rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">Send</button>
        </div>
      </aside>
    </div>
  )
}
