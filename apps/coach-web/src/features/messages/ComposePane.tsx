import { useState } from 'react'
import { useStartConversation } from '../../lib/queries/conversations'
import { sendMessage } from '../../lib/queries/chat'
import { supabase } from '../../lib/supabase'
import type { ChatPerson } from '../../lib/types'
import { PeoplePicker } from './PeoplePicker'
import { toggleIn } from '../../lib/conversations'

/** New message → To:. One person = 1:1, two or more = group; an identical
 *  existing member set reopens that conversation (server-side). */
export function ComposePane({ onOpen, onCancel }: { onOpen: (threadId: string) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<ChatPerson[]>([])
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const start = useStartConversation()
  const isGroup = picked.length >= 2
  const athletes = picked.filter((p) => p.person_kind === 'athlete').length

  const submit = async () => {
    setError(null)
    try {
      const id = await start.mutateAsync({ userIds: picked.map((p) => p.user_id), title: isGroup && name.trim() ? name.trim() : null })
      if (body.trim()) await sendMessage(supabase, id, { body: body.trim() })
      onOpen(id)
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? ''
      setError(msg.includes('language') ? "That name or message includes language that isn't allowed."
        : msg.includes("can't add") ? "One of those people can't be added to a chat."
        : "Couldn't start that conversation. Try again.")
    }
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-lg font-bold">New message</p>
        <button onClick={onCancel} className="text-sm text-text-mute hover:text-text">Cancel</button>
      </header>
      <PeoplePicker selected={picked} onToggle={(p) => setPicked((l) => toggleIn(l, p))} />
      {athletes >= 2 && (
        <p className="border-t border-line px-4 py-2 text-xs text-text-mute">Athletes in this group will see each other's names and messages.</p>
      )}
      {isGroup && (
        <input aria-label="Group name" placeholder="Group name (optional)" value={name} onChange={(e) => setName(e.target.value)}
          className="border-t border-line bg-transparent px-4 py-2 text-sm text-text outline-none placeholder:text-text-faint" />
      )}
      {error && <p className="px-4 py-1 text-xs text-missed">{error}</p>}
      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea aria-label="Message" rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…"
          className="max-h-28 flex-1 resize-none rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
        <button onClick={submit} disabled={!picked.length || start.isPending}
          className="rb-glow rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">Send</button>
      </div>
    </section>
  )
}
