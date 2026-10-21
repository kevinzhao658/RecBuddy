import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useMessages, useSendMessage, useSendImages, useMarkThreadRead, useRealtimeThread, signedChatImageUrl } from '../../lib/queries/chat'
import { useThreadPeople } from '../../lib/queries/conversations'
import { useReactions, useSetReaction } from '../../lib/queries/reactions'
import { summarize } from '../../lib/reactions'
import { blockUser } from '../../lib/queries/moderation'
import { ReportDialog, type ReportTarget } from '../chat/ReportDialog'
import { ConfirmDialog } from '../roster/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { conversationTitle } from '../../lib/conversations'
import { copyText, quotePreview } from '../../lib/messageText'
import { copyTextToClipboard, copyImageToClipboard, imageFilesFromClipboard } from '../../lib/clipboard'
import { useUnit } from '../../lib/useUnit'
import type { Conversation, Message, ImageCard, Workout } from '../../lib/types'
import type { MessageAction } from '../chat/MessageActions'
import { latestCardIds, supersededCardIds } from '../../lib/runcardRollup'
import { MessageItem, type Sender } from '../chat/MessageItem'

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

/** One conversation (team or chat): messages, reactions-ready rows, reply,
 *  copy/paste, photos, and the composer. Rendered by the Messages page. */
export function ThreadView({ threadId, conversation, onOpenDay, onInfo, initialWorkout }: {
  threadId: string
  /** Inbox row for the header (title, members, read-only). */
  conversation?: Conversation | null
  onOpenDay?: (date: string, workoutId?: string) => void
  onInfo?: () => void
  /** "Message athlete about this" — attach this workout to the composer. */
  initialWorkout?: Pick<Workout, 'id' | 'date' | 'type' | 'title'> | null
}) {
  const { session } = useAuth()
  const meId = session!.user.id
  const messagesQ = useMessages(threadId)
  const send = useSendMessage(threadId)
  const sendImages = useSendImages(threadId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const markRead = useMarkThreadRead(threadId)
  useRealtimeThread(threadId)

  const people = useThreadPeople(threadId)
  const reactionsQ = useReactions(threadId)
  const setReaction = useSetReaction(threadId)
  const readOnly = conversation?.read_only ?? false
  const qc = useQueryClient()
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const [blockTarget, setBlockTarget] = useState<ReportTarget | null>(null)
  const [modError, setModError] = useState<string | null>(null)
  const doBlock = async (t: ReportTarget) => {
    setBlockTarget(null)
    try {
      await blockUser(supabase, t.userId)
      qc.invalidateQueries({ queryKey: ['messages', threadId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['blocked'] })
    } catch { setModError(`Couldn't block ${t.userName}. Try again.`) }
  }
  const { unit } = useUnit()
  // Replies: the message being answered; a workout attached from the results
  // view; the row flashed after jumping to an original from its quote.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [workoutQuote, setWorkoutQuote] = useState(initialWorkout ?? null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  /** Per-message actions (hover bar / right-click / long-press). */
  const actionsFor = (m: Message): MessageAction[] => {
    const out: MessageAction[] = [{ key: 'reply', label: 'Reply', onClick: () => startReply(m) }]
    const text = copyText(m, unit)
    if (text) out.push({ key: 'copy', label: 'Copy', doneLabel: 'Copied', onClick: () => copyTextToClipboard(text) })
    const img = m.kind === 'image' ? (m.payload as ImageCard | null) : null
    if (img?.path || (img?.url && /^https:\/\//i.test(img.url))) {
      out.push({ key: 'copy-image', label: 'Copy image', doneLabel: 'Copied', onClick: async () =>
        copyImageToClipboard(img.path ? await signedChatImageUrl(img.path) : img.url!) })
    }
    if (m.from_user_id !== meId) {
      const name = senders[m.from_user_id]?.name ?? 'this person'
      out.push({ key: 'report', label: 'Report', onClick: () => setReportTarget({ userId: m.from_user_id, userName: name, messageId: m.id }) })
      out.push({ key: 'block', label: `Block ${name}`, onClick: () => setBlockTarget({ userId: m.from_user_id, userName: name }) })
    }
    return out
  }
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
    document.getElementById(`msg-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  const byId = useMemo(() => new Map((messagesQ.data ?? []).map((m) => [m.id, m])), [messagesQ.data])

  // Resolve each from_user_id → name/initials: every coach on the team + the athlete.
  const senders: Record<string, Sender> = {}
  for (const p of people.data ?? []) senders[p.user_id] = { name: p.name, initials: p.initials || initialsOf(p.name), avatarUrl: p.avatar_url }
  const title = conversation ? conversationTitle(conversation) : 'Conversation'
  const subtitle = conversation?.kind === 'team' ? 'Team chat'
    : (conversation?.members.length ?? 0) > 1 ? `${(conversation?.members.length ?? 0) + 1} people` : 'Private conversation'

  // Mark the athlete's unread messages read once the thread opens.
  useEffect(() => { if (threadId) markRead.mutate() }, [threadId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the latest message in view.
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight }) }, [messages.length])
  // Auto-grow the composer with line breaks, up to ~7rem (max-h-28), then scroll.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [text])

  function startReply(m: Message) {
    setReplyingTo(m)
    taRef.current?.focus()
  }
  const authorOf = (m: Message) => m.from_user_id === meId ? 'You' : senders[m.from_user_id]?.name ?? 'Coach'
  const quoteFor = (m: Message) => {
    if (!m.reply_to_id) return undefined
    const original = byId.get(m.reply_to_id)
    if (!original) return { author: '', text: '', available: false }
    return {
      author: authorOf(original), text: quotePreview(original), available: true,
      onClick: () => {
        jumpToMessage(original.id)
        setHighlightId(original.id)
        setTimeout(() => setHighlightId((h) => (h === original.id ? null : h)), 1200)
      },
    }
  }

  const submit = () => {
    const body = text.trim()
    if (!threadId) return
    if (staged.length) {
      sendImages.mutate({ files: staged, body: body || undefined, replyToId: replyingTo?.id ?? null })
      setStaged([])
      setText('')
      setReplyingTo(null)
      return
    }
    if (!body) return
    send.mutate({ body, replyToId: replyingTo?.id ?? null, workout: workoutQuote })
    setText('')
    setReplyingTo(null)
    setWorkoutQuote(null)
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold leading-tight">{title}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{subtitle}</p>
          </div>
          {onInfo && (
            <button aria-label="Conversation info" onClick={onInfo}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-sm text-text-mute hover:text-text">i</button>
          )}
        </header>

        <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto p-4">
          {messagesQ.isLoading && <p className="text-sm text-text-faint">Loading…</p>}
          {!messagesQ.isLoading && messages.length === 0 && (
            <p className="m-auto max-w-[80%] text-center text-sm text-text-faint">No messages yet. Say hello.</p>
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
                  onOpenWorkout={onOpenDay} actions={actionsFor(m)}
                  quote={quoteFor(m)} highlighted={highlightId === m.id}
                  reactions={summarize(reactionsQ.data ?? [], m.id, meId, (uid) => (uid === meId ? 'You' : senders[uid]?.name ?? 'Someone'))}
                  onReact={readOnly ? undefined : (kind) => setReaction.mutate({ messageId: m.id, kind })} />
              </Fragment>
            )
          })}
        </div>

        {readOnly ? (
          <p className="border-t border-line px-4 py-4 text-center text-sm text-text-mute">This conversation is read-only.</p>
        ) : (<>
        {/* Reply / workout context — shown above the composer until sent or cleared */}
        {(replyingTo || workoutQuote) && (
          <div className="space-y-2 border-t border-line px-3 pt-3">
            {replyingTo && (
              <ComposerContext title={`Replying to ${authorOf(replyingTo)}`} detail={quotePreview(replyingTo)}
                clearLabel="Cancel reply" onClear={() => setReplyingTo(null)} />
            )}
            {workoutQuote && (
              <ComposerContext title="About a workout" detail={workoutQuote.title}
                clearLabel="Remove workout" onClear={() => setWorkoutQuote(null)} />
            )}
          </div>
        )}

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
          <textarea ref={taRef} aria-label="Message" value={text} rows={1} autoFocus={!!initialWorkout}
            placeholder={staged.length ? 'Add a caption…' : 'Message…'}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // Pasted screenshots / copied photos stage as attachments; text pastes normally.
              const files = imageFilesFromClipboard(e.clipboardData)
              if (!files.length) return
              e.preventDefault()
              setStaged((prev) => [...prev, ...files].slice(0, MAX_PHOTOS))
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            className="max-h-28 flex-1 resize-none overflow-y-auto rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
          <button aria-label="Send message" onClick={submit} disabled={(!text.trim() && !staged.length) || send.isPending || sendImages.isPending}
            className="rb-glow rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">Send</button>
        </div>
        </>)}
        {modError && <p className="px-4 pb-2 text-xs text-missed">{modError}</p>}
        {reportTarget && <ReportDialog open target={reportTarget} onClose={() => setReportTarget(null)}
          onDone={(blocked) => { if (blocked) { qc.invalidateQueries({ queryKey: ['messages', threadId] }); qc.invalidateQueries({ queryKey: ['conversations'] }) } }} />}
        <ConfirmDialog open={!!blockTarget} confirmLabel="Block"
          title={blockTarget ? `Block ${blockTarget.userName}? They can't message you or add you to chats, and their messages are hidden from you.` : ''}
          onCancel={() => setBlockTarget(null)} onConfirm={() => blockTarget && doBlock(blockTarget)} />
    </section>
  )
}

/** "Replying to …" / "About a workout" bar above the composer. */
function ComposerContext({ title, detail, clearLabel, onClear }: { title: string; detail: string; clearLabel: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[3px] self-stretch rounded-full bg-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-accent">{title}</p>
        <p className="truncate text-xs text-text-mute">{detail}</p>
      </div>
      <button aria-label={clearLabel} onClick={onClear}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface2 text-xs text-text ring-1 ring-line hover:text-missed">✕</button>
    </div>
  )
}
