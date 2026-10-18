import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Wordmark } from '../../components/ui/Wordmark'
import { ArrowLeftIcon } from '../../components/ui/FormIcons'
import { ReportsQueue } from '../../features/admin/ReportsQueue'
import { UserLookup } from '../../features/admin/UserLookup'
import { AuditLog } from '../../features/admin/AuditLog'

const SECTIONS = [
  { to: '/admin/reports', label: 'Reports', hint: 'Content users reported — review and act on it' },
  { to: '/admin/users', label: 'Users', hint: 'Look up any account: teams, reports, suspend or remove' },
  { to: '/admin/audit', label: 'Audit log', hint: 'Every admin action: who did what, when, and why' },
]

/** /admin — moderation console (gated by RequireAdmin in App.tsx).
 *  Desktop is a fixed-height shell: one slim bar on top, and each section
 *  owns its scrolling below it. */
export default function AdminPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text md:h-screen md:overflow-hidden">
      <header className="shrink-0 border-b border-hairline">
        <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-3 px-6">
          <Wordmark className="text-xl" />
          <span className="rounded-md bg-missed/15 px-1.5 py-0.5 text-[11px] font-semibold text-missed">Admin</span>
          <nav aria-label="Admin sections" className="ml-3 flex h-full items-stretch">
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} title={s.hint}
                className={({ isActive }) => `flex items-center border-b-2 px-3 text-sm font-semibold transition ${isActive ? 'border-accent text-text' : 'border-transparent text-text-mute hover:text-text'}`}>
                {s.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/coach" className="ml-auto flex items-center gap-1.5 text-xs text-text-mute hover:text-text">
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Coach app
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pt-4 md:min-h-0">
        <Routes>
          <Route path="reports" element={<ReportsQueue />} />
          <Route path="users" element={<Scroll><UserLookup /></Scroll>} />
          <Route path="audit" element={<Scroll><AuditLog /></Scroll>} />
          {/* Absolute: a relative redirect inside this splat route appends forever. */}
          <Route path="*" element={<Navigate to="/admin/reports" replace />} />
        </Routes>
      </main>
    </div>
  )
}

/** Sections without their own panes scroll as one region under the bar. */
function Scroll({ children }: { children: ReactNode }) {
  return <div className="pb-6 md:min-h-0 md:flex-1 md:overflow-y-auto">{children}</div>
}
