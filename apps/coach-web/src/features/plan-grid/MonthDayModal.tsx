import type { Workout } from '../../lib/types'
import { Modal } from '../../components/ui/Modal'
import { TypeIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'
import { fmtShortDate } from '../../lib/week'

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekday = (iso: string) => {
  const dt = new Date(iso + 'T00:00:00Z')
  return isNaN(dt.getTime()) ? '' : WEEKDAY[dt.getUTCDay()]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  done: { label: '✓ Completed', cls: 'text-accent' },
  missed: { label: 'Missed', cls: 'text-missed' },
  planned: { label: 'Planned', cls: 'text-text-faint' },
  today: { label: 'Planned', cls: 'text-text-faint' },
  rest: { label: 'Rest', cls: 'text-text-faint' },
}

/** Read-only overview of a day that holds several workouts. Tapping one hands it
 *  to the week editor (via onPick) so the coach can adjust it — the month grid's
 *  answer to the weekly view's click-to-edit. */
export function MonthDayModal({ open, date, workouts, onPick, onClose }: {
  open: boolean; date: string; workouts: Workout[]; onPick: (id: string) => void; onClose: () => void
}) {
  const { unit } = useUnit()
  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{weekday(date)}</p>
          <p className="font-display text-lg font-bold tracking-tight text-text">{fmtShortDate(date)}</p>
          <p className="mt-0.5 text-xs text-text-mute">{workouts.length} workouts · tap one to edit</p>
        </div>
        <button aria-label="Close" onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-faint hover:bg-chip hover:text-text">✕</button>
      </div>
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        {workouts.map((w) => {
          const st = STATUS[w.status] ?? STATUS.planned
          const mins = estMinutes(w)
          return (
            <button key={w.id} onClick={() => onPick(w.id)}
              className="rb-card-sm border border-line p-3 text-left transition hover:border-text-mute hover:bg-surface2">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <TypeIcon type={w.type} className="shrink-0" />
                  <span className="truncate font-semibold text-text">{w.title}</span>
                </span>
                <span className={`shrink-0 text-xs font-semibold ${st.cls}`}>{st.label}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-num text-xs text-text-mute">
                {w.dist != null && <span>{fmtDist(w.dist, unit)} {unit} · {fmtPace(w.pace, unit)}</span>}
                {mins > 0 && <span>{fmtDur(mins)}</span>}
              </div>
              {w.note && <p className="mt-1.5 line-clamp-2 text-xs text-text-faint">{w.note}</p>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
