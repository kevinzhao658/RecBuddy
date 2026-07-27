import type { ReactNode } from 'react'

export type PlanView = 'week' | 'month'

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

/** Week/Month toggle + period navigation + a stats slot (week or month totals). */
export function PlanToolbar({ view, onWeek, onMonth, onPrev, onNext, label, isCurrent, stats, onLibrary }: {
  view: PlanView; onWeek: () => void; onMonth: () => void; onPrev: () => void; onNext: () => void
  label: string; isCurrent: boolean; stats?: ReactNode; onLibrary?: () => void
}) {
  const tab = (active: boolean) =>
    `rounded-[8px] px-4 py-1.5 text-sm transition ${active ? 'bg-surface font-semibold text-text shadow-sm' : 'font-medium text-text-faint hover:text-text'}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
      <div className="flex items-center gap-5">
        <div className="inline-flex rounded-[10px] bg-surface2 p-1">
          <button onClick={onWeek} className={tab(view === 'week')}>Week</button>
          <button onClick={onMonth} className={tab(view === 'month')}>Month</button>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={onPrev} className="text-2xl leading-none text-text-mute hover:text-text">‹</button>
          <span className="font-num text-sm font-medium tabular-nums text-text">{label}</span>
          <button aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={onNext} className="text-2xl leading-none text-text-mute hover:text-text">›</button>
          {isCurrent && <span className="ml-1 hidden text-xs text-text-faint sm:inline">{view === 'week' ? 'This week' : 'This month'}</span>}
        </div>
        {onLibrary && (
          <button aria-label="Open workout library" onClick={onLibrary}
            className="lg:hidden flex items-center gap-1.5 rounded-[10px] border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-text-mute hover:border-text-mute hover:text-text">
            <BookIcon /> Library
          </button>
        )}
      </div>
      {stats}
    </div>
  )
}
