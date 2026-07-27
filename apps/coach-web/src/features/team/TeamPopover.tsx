import { useState } from 'react'
import { useTeam, useSearchCoaches, useAddAssistant, useRemoveAssistant, useSetCoachPermission, type CoachHit } from '../../lib/queries/team'
import type { CoachPermission } from '../../lib/types'
import { Avatar } from '../../components/ui/Avatar'

const PERMISSIONS: CoachPermission[] = ['read', 'edit', 'admin']
const PERMISSION_LABEL: Record<CoachPermission, string> = { read: 'Read', edit: 'Edit', admin: 'Admin' }

/** Segmented Read / Edit / Admin control for one team member (admins only). */
function PermissionControl({ value, coachName, onChange }: {
  value: CoachPermission; coachName: string; onChange: (p: CoachPermission) => void
}) {
  return (
    <div role="group" aria-label={`Permission for ${coachName}`} className="flex overflow-hidden rounded-[8px] border border-line">
      {PERMISSIONS.map((p) => (
        <button key={p} aria-label={`${PERMISSION_LABEL[p]} access for ${coachName}`} aria-pressed={value === p}
          onClick={() => value !== p && onChange(p)}
          className={`px-1.5 py-0.5 text-[10px] font-semibold transition ${
            value === p ? 'bg-accent text-on-accent' : 'text-text-mute hover:text-text'}`}>
          {PERMISSION_LABEL[p]}
        </button>
      ))}
    </div>
  )
}

export function TeamPopover({ athleteId, isAdmin }: { athleteId: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CoachHit[]>([])
  const team = useTeam(athleteId)
  const search = useSearchCoaches()
  const add = useAddAssistant(athleteId)
  const remove = useRemoveAssistant(athleteId)
  const setPermission = useSetCoachPermission(athleteId)
  const members = team.data ?? []

  const runSearch = (value: string) => {
    setQ(value)
    if (value.trim()) search.mutate(value, { onSuccess: setResults })
    else setResults([])
  }

  return (
    <div className="relative">
      <div className="flex shrink-0 items-center -space-x-2">
        {/* Cap the visible stack at 3; the rest collapse into a +N chip. */}
        {members.slice(0, 3).map((m) => <Avatar key={m.coach_id} size="team" initials={m.coach?.initials ?? '?'} url={m.coach?.avatar_url} className="ring-1 ring-line" />)}
        {members.length > 3 && (
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-surface2 text-[10px] font-semibold text-text-mute ring-1 ring-line md:h-9 md:w-9 md:rounded-[10px] md:text-xs">
            +{members.length - 3}
          </span>
        )}
        {isAdmin && <button aria-label="Manage coaching team" onClick={() => setOpen((o) => !o)}
          className="ml-3 grid h-7 w-7 place-items-center rounded-full border border-dashed border-line text-sm text-text-mute hover:border-text-mute hover:text-text md:h-9 md:w-9">+</button>}
      </div>
      {open && isAdmin && (
        <div className="rb-card absolute right-0 z-40 mt-2 w-72 p-3">
          <div className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Coaching team</div>
          {members.map((m) => (
            <div key={m.coach_id} className="flex items-center gap-2 py-1">
              <Avatar initials={m.coach?.initials ?? '?'} url={m.coach?.avatar_url} />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{m.coach?.name ?? 'Coach'}</span>
                <span className="block text-xs text-text-mute">{m.relationship}</span>
              </span>
              <PermissionControl value={m.permission} coachName={m.coach?.name ?? 'Coach'}
                onChange={(permission) => setPermission.mutate({ coachId: m.coach_id, permission })} />
              {m.relationship === 'assistant' && <button aria-label={`Remove ${m.coach?.name ?? 'coach'}`} onClick={() => remove.mutate(m.coach_id)} className="shrink-0 text-text-faint hover:text-text">✕</button>}
            </div>
          ))}
          <input aria-label="Search coaches" value={q} onChange={(e) => runSearch(e.target.value)} placeholder="Add a co-coach by name or email…"
            className="mt-2 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-sm text-text" />
          {results.filter((r) => !members.some((m) => m.coach_id === r.id)).map((r) => (
            <button key={r.id} onClick={() => { add.mutate(r.id); setQ(''); setResults([]) }}
              className="flex w-full items-center gap-2 py-1 text-left text-sm hover:text-accent">
              <Avatar initials={r.initials} url={r.avatar_url} /> <span className="flex-1">{r.name}<span className="block text-xs text-text-mute">{r.title}</span></span> +
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
