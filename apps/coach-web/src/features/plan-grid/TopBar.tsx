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

export function TopBar({ athlete, plan, actions }: { athlete: Profile; plan: Plan | null; actions?: ReactNode }) {
  return (
    <header className="flex items-center gap-4 border-b border-line px-6 py-4">
      <Avatar initials={athlete.initials} className="h-12 w-12 rounded-[12px] text-base" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[26px] font-bold leading-tight tracking-tight">{athlete.name}</h2>
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
