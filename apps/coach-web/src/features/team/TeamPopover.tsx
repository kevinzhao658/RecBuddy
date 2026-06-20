import { useState } from 'react'
import { useTeam, useSearchCoaches, useAddAssistant, useRemoveAssistant, type CoachHit } from '../../lib/queries/team'
import { Avatar } from '../../components/ui/Avatar'

export function TeamPopover({ athleteId, isHead }: { athleteId: string; isHead: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CoachHit[]>([])
  const team = useTeam(athleteId)
  const search = useSearchCoaches()
  const add = useAddAssistant(athleteId)
  const remove = useRemoveAssistant(athleteId)
  const members = team.data ?? []

  const runSearch = (value: string) => {
    setQ(value)
    if (value.trim()) search.mutate(value, { onSuccess: setResults })
    else setResults([])
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {members.map((m) => <Avatar key={m.coach_id} initials={m.coach?.initials ?? '?'} className="ring-1 ring-line" />)}
        {isHead && <button aria-label="Manage coaching team" onClick={() => setOpen((o) => !o)}
          className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line text-text-mute">+</button>}
      </div>
      {open && isHead && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-[14px] border border-line bg-surface p-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-text-mute">Coaching team</div>
          {members.map((m) => (
            <div key={m.coach_id} className="flex items-center gap-2 py-1">
              <Avatar initials={m.coach?.initials ?? '?'} />
              <span className="flex-1 text-sm">{m.coach?.name ?? 'Coach'}<span className="block text-xs text-text-mute">{m.relationship}</span></span>
              {m.relationship === 'assistant' && <button aria-label={`Remove ${m.coach?.name ?? 'coach'}`} onClick={() => remove.mutate(m.coach_id)} className="text-text-faint">✕</button>}
            </div>
          ))}
          <input aria-label="Search coaches" value={q} onChange={(e) => runSearch(e.target.value)} placeholder="Add an assistant…"
            className="mt-2 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-sm text-text" />
          {results.filter((r) => !members.some((m) => m.coach_id === r.id)).map((r) => (
            <button key={r.id} onClick={() => { add.mutate(r.id); setQ(''); setResults([]) }}
              className="flex w-full items-center gap-2 py-1 text-left text-sm hover:text-accent">
              <Avatar initials={r.initials} /> <span className="flex-1">{r.name}<span className="block text-xs text-text-mute">{r.title}</span></span> +
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
