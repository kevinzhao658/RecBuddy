import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRoster } from '../../lib/queries/roster'
import { usePendingInvites, useRevokeInvite } from '../../lib/queries/invites'
import { useMe } from '../../lib/queries/me'
import { useUnreadCounts } from '../../lib/queries/chat'
import { useConversations } from '../../lib/queries/conversations'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { UnreadBadge } from '../../components/ui/UnreadBadge'
import { Wordmark } from '../../components/ui/Wordmark'
import { NavIcon } from '../../components/ui/Icon'
import { AddAthleteModal } from './AddAthleteModal'
import { LinkRequests } from '../team/LinkRequests'
import { SettingsModal } from '../settings/SettingsModal'
import { supabase } from '../../lib/supabase'
import { fmtShortDate } from '../../lib/week'

const RACE_LEVEL: Record<string, string> = { '3.1 mi': '5K', '6.2 mi': '10K', '13.1 mi': 'Half Marathon', '26.2 mi': 'Marathon' }

export function RosterSidebar({ selectedId, onSelect, messagesActive = false }: {
  selectedId: string | null; onSelect: (id: string) => void
  /** On /coach/messages: the view switch shows Messages as current. */
  messagesActive?: boolean
}) {
  const me = useMe()
  const navigate = useNavigate()
  const inbox = useConversations(me.data?.id ?? null)
  const unreadTotal = (inbox.data ?? []).reduce((n, c) => n + c.unread, 0)
  const roster = useRoster()
  const pending = usePendingInvites()
  const revoke = useRevokeInvite()
  const unread = useUnreadCounts()
  const [addOpen, setAddOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const away = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [menuOpen])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const athletes = roster.data ?? []

  return (
    <aside className="rb-surface flex w-72 flex-col border-r border-line">
      {/* Brand + view switch */}
      <div className="flex items-start justify-between px-5 pb-4 pt-5">
        <div>
          <Wordmark className="text-2xl" />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-faint">Coach</p>
        </div>
        <div role="group" aria-label="View" className="mt-0.5 flex rounded-full border border-line bg-surface2/60 p-0.5">
          <ViewToggle label="Plans" active={!messagesActive} onClick={() => navigate('/coach')}>
            <NavIcon name="plans" />
          </ViewToggle>
          <ViewToggle label="Messages" active={messagesActive} onClick={() => navigate('/coach/messages')}
            ariaLabel={unreadTotal ? `Messages, ${unreadTotal} unread` : 'Messages'}>
            <NavIcon name="messages" />
            <UnreadBadge count={unreadTotal} className="absolute -right-1.5 -top-1.5 h-4 min-w-4 text-[10px]" />
          </ViewToggle>
        </div>
      </div>

      <LinkRequests />

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
              <Avatar initials={r.athlete.initials} url={r.athlete.avatar_url} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-text">{r.athlete.name}</span>
                <span className="block truncate text-xs text-text-mute">{sub}</span>
              </span>
              <UnreadBadge count={unread.data?.[r.athlete.id] ?? 0} className="shrink-0" />
              {needsCheckin && <span title="Needs check-in" className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-faint" />}
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
        <div ref={menuRef} className="relative">
          {/* The name and photo are the menu's trigger — no separate ⋯ button. */}
          <button onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}
            className={`flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition hover:bg-chip ${menuOpen ? 'bg-chip' : ''}`}>
            <Avatar initials={me.data?.initials ?? '·'} url={me.data?.avatar_url} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-text">{me.data?.name ?? 'Coach'}</span>
              <span className="block truncate text-xs text-text-mute">{me.data?.title ?? ''}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="rb-glass absolute bottom-full left-0 right-0 z-30 mb-2 rounded-[14px] p-1 motion-safe:animate-rb-menu origin-bottom">
              <button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-text hover:bg-chip">Settings</button>
              <button onClick={() => supabase.auth.signOut()}
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-missed hover:bg-chip">Log out</button>
            </div>
          )}
        </div>
      </div>

      <AddAthleteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  )
}

/** One icon in the Plans | Messages switch; its name shows as a tooltip on hover or focus. */
function ViewToggle({ label, ariaLabel, active, onClick, children }: {
  label: string; ariaLabel?: string; active: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel ?? label} aria-pressed={active}
      className={`group relative grid h-8 w-9 place-items-center rounded-full transition ${active ? 'bg-accent text-on-accent' : 'text-text-mute hover:text-text'}`}>
      {children}
      <span role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-surface2 px-2 py-1 text-[11px] font-semibold text-text opacity-0 ring-1 ring-line transition group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  )
}
