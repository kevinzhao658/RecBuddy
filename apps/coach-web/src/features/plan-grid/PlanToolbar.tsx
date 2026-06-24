import type { ReactNode } from 'react'

export type PlanView = 'week' | 'month'

/** Week/Month toggle + period navigation + a stats slot (week or month totals). */
export function PlanToolbar({ view, onWeek, onMonth, onPrev, onNext, label, isCurrent, stats }: {
  view: PlanView; onWeek: () => void; onMonth: () => void; onPrev: () => void; onNext: () => void
  label: string; isCurrent: boolean; stats?: ReactNode
}) {
  const tab = (active: boolean) =>
    `rounded-[8px] px-4 py-1.5 text-sm transition ${active ? 'bg-surface font-semibold text-text shadow-sm' : 'font-medium text-text-faint hover:text-text'}`

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="inline-flex rounded-[10px] bg-surface2 p-1">
          <button onClick={onWeek} className={tab(view === 'week')}>Week</button>
          <button onClick={onMonth} className={tab(view === 'month')}>Month</button>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={onPrev} className="text-2xl leading-none text-text-mute hover:text-text">‹</button>
          <span className="font-num text-sm font-medium tabular-nums text-text">{label}</span>
          <button aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={onNext} className="text-2xl leading-none text-text-mute hover:text-text">›</button>
          {isCurrent && <span className="ml-1 text-xs text-text-faint">{view === 'week' ? 'This week' : 'This month'}</span>}
        </div>
      </div>
      {stats}
    </div>
  )
}
