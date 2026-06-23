import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useThread, useMessages, useSendMessage, useMarkThreadRead, useRealtimeThread } from '../../lib/queries/chat'
import { MessageItem } from './MessageItem'

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

  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = messagesQ.data ?? []

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

        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {messagesQ.isLoading && <p className="text-sm text-text-faint">Loading…</p>}
          {!messagesQ.isLoading && messages.length === 0 && (
            <p className="m-auto max-w-[80%] text-center text-sm text-text-faint">No messages yet. Say hello to {athleteName.split(' ')[0]}.</p>
          )}
          {messages.map((m) => <MessageItem key={m.id} m={m} mine={m.from_user_id === meId} onOpenWorkout={onOpenDay} />)}
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
