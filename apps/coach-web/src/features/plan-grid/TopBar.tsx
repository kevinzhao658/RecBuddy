import type { ReactNode } from 'react'
import type { Plan, Profile } from '../../lib/types'
import { Avatar } from '../../components/ui/Avatar'
import { fmtShortDate } from '../../lib/week'

function FlagIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function TopBar({ athlete, plan, actions, onMenu }: { athlete: Profile; plan: Plan | null; actions?: ReactNode; onMenu?: () => void }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-6 py-4">
      {onMenu && (
        <button aria-label="Open roster" onClick={onMenu}
          className="md:hidden grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 text-text-mute hover:text-text">
          <HamburgerIcon />
        </button>
      )}
      <Avatar initials={athlete.initials} className="h-10 w-10 rounded-[12px] text-base md:h-12 md:w-12" />
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="truncate text-xl font-bold leading-tight tracking-tight md:text-[26px]">{athlete.name}</h2>
        {plan && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-text-mute">
            <FlagIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate">{plan.goal_race} · {fmtShortDate(plan.goal_date)} · Week {plan.plan_week} of {plan.plan_weeks}</span>
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
