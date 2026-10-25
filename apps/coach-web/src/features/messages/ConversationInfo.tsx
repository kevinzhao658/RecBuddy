import { useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { useAddMembers, useHideConversation, useLeaveConversation, useRemoveMember, useRenameConversation } from '../../lib/queries/conversations'
import { useMe } from '../../lib/queries/me'
import { canRemoveMembers, conversationTitle, toggleIn } from '../../lib/conversations'
import type { ChatPerson, Conversation, ConversationMember } from '../../lib/types'
import { PeoplePicker } from './PeoplePicker'
import { ConfirmDialog } from '../roster/ConfirmDialog'

/** Members (counted, me first), group name (groups and team chats), add or
 *  remove people, leave (groups) or hide (1:1). */
export function ConversationInfo({ conversation, onClose, onOpenThread, onGone }: {
  conversation: Conversation; onClose: () => void
  /** Adding people to a 1:1 or a team chat starts a NEW group — open it. */
  onOpenThread: (threadId: string) => void
  /** After leaving / hiding. */
  onGone?: () => void
}) {
  const isTeam = conversation.kind === 'team'
  const isGroup = !isTeam && conversation.members.length >= 2
  const readOnly = conversation.read_only
  const [name, setName] = useState(conversation.title ?? '')
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<ChatPerson[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [removing, setRemoving] = useState<ConversationMember | null>(null)
  const me = useMe().data
  const remove = useRemoveMember()
  const canRemove = canRemoveMembers(conversation)
  const rename = useRenameConversation()
  const add = useAddMembers()
  const leave = useLeaveConversation()
  const hide = useHideConversation()
  const id = conversation.thread_id

  return (
    <aside className="rb-surface flex h-full w-80 shrink-0 flex-col border-l border-line" aria-label="Conversation info">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="truncate font-semibold">{conversationTitle(conversation)}</p>
        <button aria-label="Close info" onClick={onClose} className="text-text-faint hover:text-text">✕</button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {readOnly && <p className="rounded-[10px] bg-surface2 px-3 py-2 text-xs text-text-mute">This conversation is read-only.</p>}
        {(isGroup || isTeam) && !readOnly && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">Group name</p>
            <div className="flex gap-2">
              <input aria-label="Group name" value={name} onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-[10px] border border-line bg-surface2 px-3 py-1.5 text-sm text-text outline-none" />
              <button disabled={name.trim() === (conversation.title ?? '')}
                onClick={() => rename.mutate({ threadId: id, title: name }, { onError: () => setError("Couldn't rename.") })}
                className="text-sm font-semibold text-accent disabled:opacity-40">Save</button>
            </div>
          </div>
        )}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">{conversation.members.length + 1} people</p>
          <div data-testid="person-row" className="flex items-center gap-2 py-1">
            <Avatar initials={me?.initials ?? ''} url={me?.avatar_url} size="sm" />
            <span className="text-sm text-text">You</span>
          </div>
          {conversation.members.map((m) => (
            <div key={m.user_id} data-testid="person-row" className="group/person flex items-center gap-2 py-1">
              <Avatar initials={m.initials} url={m.avatar_url} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-text">{m.name}</span>
              {canRemove && (
                <button onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`}
                  className="text-xs font-semibold text-text-faint transition hover:text-missed focus-visible:text-missed">Remove</button>
              )}
            </div>
          ))}
          {!readOnly && !adding && (
            <button onClick={() => setAdding(true)} className="mt-2 text-sm font-semibold text-accent">Add people</button>
          )}
        </div>
        {adding && (
          <div className="flex h-80 flex-col rounded-[12px] border border-line">
            {isTeam && <p className="border-b border-line px-3 py-2 text-xs text-text-mute">
              This starts a new group with everyone here. The team chat stays private to the team.</p>}
            <PeoplePicker selected={picked} onToggle={(p) => setPicked((l) => toggleIn(l, p))}
              excluded={conversation.members.map((m) => m.user_id)} />
            <div className="flex justify-end gap-3 border-t border-line p-2">
              <button onClick={() => { setAdding(false); setPicked([]) }} className="text-sm text-text-mute">Cancel</button>
              <button disabled={!picked.length} className="text-sm font-semibold text-accent disabled:opacity-40"
                onClick={async () => {
                  try {
                    const next = await add.mutateAsync({ threadId: id, userIds: picked.map((p) => p.user_id) })
                    setAdding(false); setPicked([])
                    if (next !== id) onOpenThread(next)
                  } catch { setError("Couldn't add those people.") }
                }}>Add</button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-missed">{error}</p>}
      </div>
      {!isTeam && (
        <div className="border-t border-line p-4">
          {isGroup
            ? <button onClick={() => setConfirmLeave(true)} className="text-sm font-semibold text-missed">Leave conversation</button>
            : <button onClick={() => hide.mutate(id, { onSuccess: onGone })} className="text-sm font-semibold text-text-mute">Hide conversation</button>}
        </div>
      )}
      <ConfirmDialog open={!!removing} confirmLabel="Remove"
        title={removing ? `Remove ${removing.name} from this conversation? They'll stop getting its messages. Anyone here can add them back.` : ''}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const who = removing!
          setRemoving(null)
          remove.mutate({ threadId: id, userId: who.user_id }, { onError: () => setError(`Couldn't remove ${who.name}. Try again.`) })
        }} />
      <ConfirmDialog open={confirmLeave} confirmLabel="Leave"
        title="Leave this conversation? You won't get new messages or see its history."
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); leave.mutate(id, { onSuccess: onGone }) }} />
    </aside>
  )
}
