import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { useSearchAthletes, useAddExistingAthlete, type AthleteHit } from '../../lib/queries/roster'

const field = 'w-full rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'

/** Search an existing athlete by name or email and add them to the roster,
 *  picking the role (co-coach by default). Sharing the athlete's plan — the
 *  add never touches their goal. */
export function AddExistingAthlete({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AthleteHit[]>([])
  const [picked, setPicked] = useState<AthleteHit | null>(null)
  const [role, setRole] = useState<'assistant' | 'head'>('assistant')
  const [error, setError] = useState<string | null>(null)
  const search = useSearchAthletes()
  const add = useAddExistingAthlete()

  const runSearch = (value: string) => {
    setQ(value); setPicked(null); setError(null)
    if (value.trim().length >= 2) search.mutate(value, { onSuccess: setResults })
    else setResults([])
  }

  const submit = () => {
    if (!picked) return
    add.mutate({ athleteId: picked.id, relationship: role },
      { onSuccess: onAdded, onError: (e: any) => setError(e.message) })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-mute">Find an athlete already on RecBuddy by name or email — their existing plan comes with them.</p>

      <input aria-label="Search athletes" value={q} onChange={(e) => runSearch(e.target.value)}
        placeholder="Name or email" className={field} autoFocus />

      {q.trim().length >= 2 && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {search.isPending && <p className="px-1 py-2 text-sm text-text-faint">Searching…</p>}
          {!search.isPending && results.length === 0 && (
            <p className="px-1 py-2 text-sm text-text-faint">No athlete matches that — check the spelling, or invite them as a new athlete.</p>
          )}
          {results.map((r) => {
            const selected = picked?.id === r.id
            return (
              <button key={r.id} onClick={() => { setPicked(r); setError(null) }} disabled={r.already_on_roster}
                className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-left transition disabled:opacity-50 ${selected ? 'bg-surface2 ring-1 ring-accent' : 'hover:bg-surface2/60'}`}>
                <Avatar initials={r.initials} url={r.avatar_url} />
                <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                {r.already_on_roster
                  ? <span className="shrink-0 text-[11px] text-text-faint">On your roster</span>
                  : selected && <span className="shrink-0 text-accent" aria-hidden>✓</span>}
              </button>
            )
          })}
        </div>
      )}

      {picked && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">Role for {picked.name.split(' ')[0]}</span>
          <div className="inline-flex self-start rounded-[10px] bg-surface2 p-1">
            {([['assistant', 'Co-coach'], ['head', 'Head coach']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setRole(val)}
                className={`rounded-[8px] px-4 py-1.5 text-sm transition ${role === val ? 'bg-surface font-semibold text-text shadow-sm' : 'font-medium text-text-faint hover:text-text'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-faint">
            {role === 'assistant'
              ? 'Co-coaches help alongside the head coach — the plan and its head stay as they are.'
              : 'Head coach owns the roster. Only works if the athlete has no head coach yet.'}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-missed">{error}</p>}

      <Button disabled={!picked || add.isPending} onClick={submit}>
        {add.isPending ? 'Adding…' : picked ? `Add ${picked.name.split(' ')[0]}` : 'Add to roster'}
      </Button>
    </div>
  )
}
