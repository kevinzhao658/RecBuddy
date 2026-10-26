import { useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { useSearchPeople } from '../../lib/queries/conversations'
import type { ChatPerson } from '../../lib/types'

/** To: field with pills plus search results grouped Athletes, then Coaches. */
export function PeoplePicker({ selected, onToggle, excluded = [] }: {
  selected: ChatPerson[]; onToggle: (p: ChatPerson) => void; excluded?: string[]
}) {
  const [query, setQuery] = useState('')
  const results = (useSearchPeople(query).data ?? []).filter((p) => !excluded.includes(p.user_id))
  const isPicked = (p: ChatPerson) => selected.some((s) => s.user_id === p.user_id)
  const group = (label: string, list: ChatPerson[]) => list.length > 0 && (
    <div className="mb-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">{label}</p>
      {list.map((p) => (
        <button key={p.user_id} type="button" onClick={() => onToggle(p)} aria-pressed={isPicked(p)}
          className="flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-surface2">
          <Avatar initials={p.initials} url={p.avatar_url} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text">{p.name}</span>
            <span className="block truncate text-xs text-text-mute">{p.context}</span>
          </span>
          <span className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${isPicked(p) ? 'border-accent bg-accent text-on-accent' : 'border-text-faint'}`} aria-hidden>
            {isPicked(p) ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="text-sm text-text-faint">To:</span>
        {selected.map((p) => (
          <button key={p.user_id} type="button" onClick={() => onToggle(p)} aria-label={`Remove ${p.name}`}
            className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-on-accent">{p.name}</button>
        ))}
        <input aria-label="To" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          className="min-w-[120px] flex-1 bg-transparent text-sm text-text outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {group('Athletes', results.filter((p) => p.person_kind === 'athlete'))}
        {group('Coaches', results.filter((p) => p.person_kind === 'coach'))}
        {results.length === 0 && <p className="p-3 text-sm text-text-faint">No one matches.</p>}
      </div>
    </div>
  )
}
