import { useState } from 'react'
import { useRoster, useRemoveAthlete } from '../../lib/queries/roster'
import { usePendingInvites, useRevokeInvite } from '../../lib/queries/invites'
import { useMe } from '../../lib/queries/me'
import { useUnreadCounts } from '../../lib/queries/chat'
import { Avatar } from '../../components/ui/Avatar'
import { UnreadBadge } from '../../components/ui/UnreadBadge'
import { Wordmark } from '../../components/ui/Wordmark'
import { TypeIcon } from '../../components/ui/Icon'
import { AddAthleteModal } from './AddAthleteModal'
import { ConfirmDialog } from './ConfirmDialog'
import { SettingsModal } from '../settings/SettingsModal'
import { useAuth } from '../../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { fmtShortDate } from '../../lib/week'

const RACE_LEVEL: Record<string, string> = { '3.1 mi': '5K', '6.2 mi': '10K', '13.1 mi': 'Half Marathon', '26.2 mi': 'Marathon' }

export function RosterSidebar({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { session } = useAuth()
  const me = useMe()
  const roster = useRoster()
  const pending = usePendingInvites()
  const remove = useRemoveAthlete()
  const revoke = useRevokeInvite()
  const unread = useUnreadCounts()
  const [addOpen, setAddOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const athletes = roster.data ?? []

  return (
    <aside className="rb-surface flex w-72 flex-col border-r border-line">
      {/* Brand */}
      <div className="px-5 pb-4 pt-5">
        <Wordmark className="text-2xl" />
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-faint">Coach</p>
      </div>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-mute">Athletes · {athletes.length}</span>
          <button aria-label="Add athlete" onClick={() => setAddOpen(true)}
            className="grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-accent hover:bg-chip">＋</button>
        </div>

        {athletes.map((r) => {
          const plan = r.plans?.[0]
          const sub = plan ? `${RACE_LEVEL[plan.goal_distance ?? ''] ?? plan.goal_distance ?? 'Plan'} · ${fmtShortDate(plan.goal_date)}` : 'No plan'
          const needsCheckin = plan?.status === 'Needs check-in'
          return (
            <button key={r.athlete.id} onClick={() => onSelect(r.athlete.id)}
              className={`group mb-0.5 flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition ${selectedId === r.athlete.id ? 'bg-surface2 ring-1 ring-line' : 'hover:bg-surface2/50'}`}>
              <Avatar initials={r.athlete.initials} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-text">{r.athlete.name}</span>
                <span className="block truncate text-xs text-text-mute">{sub}</span>
              </span>
              <UnreadBadge count={unread.data?.[r.athlete.id] ?? 0} className="shrink-0" />
              {needsCheckin && <span title="Needs check-in" className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-faint" />}
              <span role="button" aria-label={`Remove ${r.athlete.name}`} onClick={(e) => { e.stopPropagation(); setRemoveId(r.athlete.id) }}
                className="hidden shrink-0 text-text-faint hover:text-missed group-hover:block">🗑</span>
            </button>
          )
        })}

        {(pending.data ?? []).map((inv) => (
          <div key={inv.id} className="mb-0.5 flex items-center gap-3 rounded-[14px] px-2 py-2 opacity-60">
            <Avatar initials="?" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-text">{inv.athlete_name ?? 'Invited athlete'}</span>
              <span className="block truncate text-xs text-text-mute">
                {inv.goal_race ? `${inv.goal_race} · ` : 'Invited · '}<code className="font-num text-accent">{inv.code}</code>
              </span>
            </span>
            <button aria-label="Revoke invite" onClick={() => revoke.mutate(inv.id)} className="shrink-0 text-text-faint hover:text-text">✕</button>
          </div>
        ))}

        <button onClick={() => setAddOpen(true)}
          className="mt-1 flex w-full items-center gap-2 rounded-[14px] border border-dashed border-line px-2 py-2.5 text-sm text-text-mute hover:border-text-mute hover:text-text">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-line text-accent">＋</span>
          Add athlete
        </button>
      </div>

      {/* Coach profile + preview */}
      <div className="border-t border-line p-3">
        <div className="relative flex items-center gap-3 rounded-[14px] px-2 py-2">
          <Avatar initials={me.data?.initials ?? '·'} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-text">{me.data?.name ?? 'Coach'}</span>
            <span className="block truncate text-xs text-text-mute">{me.data?.title ?? ''}</span>
          </span>
          <button aria-label="Coach menu" onClick={() => setMenuOpen((o) => !o)}
            className="grid h-7 w-7 place-items-center rounded-full text-text-faint hover:bg-chip hover:text-text">⋯</button>
          {menuOpen && (
            <div className="rb-card absolute bottom-full right-0 z-30 mb-2 w-36 p-1">
              <button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-text hover:bg-surface2">Settings</button>
              <button onClick={() => supabase.auth.signOut()}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-text hover:bg-surface2">Log out</button>
            </div>
          )}
        </div>
        <button disabled title="Available when the athlete app ships"
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-[12px] border border-line px-3 py-2 text-sm font-medium text-text-mute disabled:opacity-70">
          <TypeIcon type="easy" className="h-4 w-4" /> Preview as athlete
        </button>
      </div>

      <AddAthleteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmDialog open={!!removeId} title="Remove this athlete from your roster?"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => { remove.mutate({ coachId: session!.user.id, athleteId: removeId! }); setRemoveId(null) }} />
    </aside>
  )
}
