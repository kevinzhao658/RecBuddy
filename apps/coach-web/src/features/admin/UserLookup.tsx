import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserDetail } from './UserDetail'
import { useAdminUsers } from '../../lib/queries/admin'

/** Search users by name / email / id; the selected user opens on the right.
 *  Selection lives in the URL (?id=) so other admin screens can link here. */
export function UserLookup() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 300) // debounce typing
    return () => clearTimeout(t)
  }, [input])
  const { data, isLoading, error } = useAdminUsers(query)

  const select = (id: string) => { const p = new URLSearchParams(params); p.set('id', id); setParams(p, { replace: true }) }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(280px,360px)_1fr]">
      <div>
        <input type="search" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Search name, email, or user ID" aria-label="Search users"
          className="mb-3 w-full rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text outline-none focus:border-accent" />
        {isLoading && <p className="text-sm text-text-mute">Loading…</p>}
        {error && <p className="text-sm text-missed">Couldn't search: {(error as Error).message}</p>}
        <ul className="space-y-2" aria-label="Users">
          {data?.map((u) => (
            <li key={u.id}>
              <button onClick={() => select(u.id)} aria-current={selectedId === u.id}
                className={`w-full rounded-[14px] border px-4 py-3 text-left transition ${selectedId === u.id ? 'border-accent bg-surface2' : 'border-line hover:border-text-mute'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text">{u.name}</span>
                  {u.suspended_at && <span className="text-xs font-semibold text-missed">Suspended</span>}
                </div>
                <p className="text-xs text-text-mute">{u.email ?? 'no email'}</p>
                <p className="text-xs text-text-faint">
                  {[u.is_coach && 'coach', u.is_athlete && 'athlete', u.is_admin && 'admin'].filter(Boolean).join(' · ')}
                  {u.reports_against > 0 && ` · ${u.reports_against} report${u.reports_against === 1 ? '' : 's'} against`}
                </p>
              </button>
            </li>
          ))}
          {data && data.length === 0 && <li className="text-sm text-text-mute">No matches.</li>}
        </ul>
      </div>
      {selectedId ? <UserDetail key={selectedId} userId={selectedId} /> : (
        <p className="rb-card p-6 text-sm text-text-mute">Pick a user to see their teams, reports, and history.</p>
      )}
    </div>
  )
}
