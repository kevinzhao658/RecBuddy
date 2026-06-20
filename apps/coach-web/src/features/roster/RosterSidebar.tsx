import { useState } from 'react'
import { useRoster, useRemoveAthlete } from '../../lib/queries/roster'
import { usePendingInvites, useRevokeInvite } from '../../lib/queries/invites'
import { Avatar } from '../../components/ui/Avatar'
import { AddAthleteModal } from './AddAthleteModal'
import { ConfirmDialog } from './ConfirmDialog'
import { useAuth } from '../../auth/AuthProvider'

export function RosterSidebar({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { session } = useAuth()
  const roster = useRoster()
  const pending = usePendingInvites()
  const remove = useRemoveAthlete()
  const revoke = useRevokeInvite()
  const [addOpen, setAddOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const athletes = roster.data ?? []

  return (
    <aside className="rb-surface flex w-72 flex-col gap-1 border-r border-line p-3">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-mute">Athletes · {athletes.length}</span>
        <button aria-label="Add athlete" onClick={() => setAddOpen(true)}
          className="grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-accent hover:bg-chip">＋</button>
      </div>
      {athletes.map((r) => (
        <button key={r.athlete.id} onClick={() => onSelect(r.athlete.id)}
          className={`group flex items-center gap-3 rounded-[14px] px-2 py-2 text-left transition ${selectedId === r.athlete.id ? 'border-l-2 border-accent bg-surface2' : 'border-l-2 border-transparent hover:bg-surface2/60'}`}>
          <Avatar initials={r.athlete.initials} />
          <span className="flex-1">
            <span className="block font-medium text-text">{r.athlete.name}</span>
            <span className="block font-num text-xs text-text-mute">{r.plans?.[0]?.goal_date ?? 'No plan'}</span>
          </span>
          <span role="button" aria-label={`Remove ${r.athlete.name}`} onClick={(e) => { e.stopPropagation(); setRemoveId(r.athlete.id) }}
            className="hidden text-text-faint group-hover:block">🗑</span>
        </button>
      ))}
      {(pending.data ?? []).map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 rounded-[14px] px-2 py-2 opacity-60">
          <Avatar initials="?" />
          <span className="flex-1">
            <span className="block text-text">{inv.athlete_name ?? 'Invited athlete'}</span>
            <span className="block text-xs text-text-mute">Invited · <code className="font-num text-accent">{inv.code}</code></span>
          </span>
          <button aria-label="Revoke invite" onClick={() => revoke.mutate(inv.id)} className="text-text-faint hover:text-text">✕</button>
        </div>
      ))}
      <button onClick={() => setAddOpen(true)} className="mt-1 rounded-[14px] border border-dashed border-line px-2 py-2 text-sm text-text-mute hover:border-text-mute hover:text-text">+ Add athlete</button>

      <AddAthleteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmDialog open={!!removeId} title="Remove this athlete from your roster?"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => { remove.mutate({ coachId: session!.user.id, athleteId: removeId! }); setRemoveId(null) }} />
    </aside>
  )
}
