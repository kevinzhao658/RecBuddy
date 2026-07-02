import { useState } from 'react'
import type { Workout } from '../../lib/types'
import { fmtShortDate } from '../../lib/week'
import { Button } from '../../components/ui/Button'
import { WorkoutFields } from '../../components/ui/WorkoutFields'
import type { WorkoutDraft } from '../../lib/queries/plan'

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function eyebrow(iso: string) {
  const dt = new Date(iso + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return iso
  return `${WEEKDAY[dt.getUTCDay()]} · ${fmtShortDate(iso)}`
}

export function WorkoutEditor({ date, workout, onSave, onClear, onShare }: {
  date: string; workout: Workout | null; onSave: (d: WorkoutDraft) => void; onClear: () => void
  onShare?: (changed: boolean, draft: WorkoutDraft) => void
}) {
  const [d, setD] = useState<WorkoutDraft>(() => ({
    type: workout?.type ?? 'easy', title: workout?.title ?? 'Easy Run',
    dist: workout?.dist ?? 4, pace: workout?.pace ?? '9:30/mi',
    est_minutes: workout?.est_minutes ?? null, dur: workout?.dur ?? null,
    note: workout?.note ?? '', sets: workout?.sets ?? [],
  }))
  const set = (patch: Partial<WorkoutDraft>) => setD({ ...d, ...patch })
  // Has the coach edited the saved workout? Drives the share button's emphasis.
  const changed = !!workout && (
    d.type !== workout.type || d.title !== workout.title || d.dist !== workout.dist ||
    d.pace !== workout.pace || (d.note ?? '') !== (workout.note ?? '') ||
    d.est_minutes !== workout.est_minutes || d.dur !== workout.dur ||
    JSON.stringify(d.sets) !== JSON.stringify(workout.sets)
  )

  return (
    <aside className="rb-surface flex w-80 shrink-0 flex-col border-l border-line">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{workout ? 'Edit day' : 'New workout'}</p>
            <p className="font-display text-lg font-bold tracking-tight text-text">{eyebrow(date)}</p>
          </div>
          {onShare && (
            <button onClick={() => onShare(changed, d)}
              className={`mt-0.5 shrink-0 rounded-[9px] border px-2 py-1 text-xs font-semibold transition ${
                changed ? 'rb-glow border-accent bg-accent/10 text-accent' : 'border-line text-text-mute hover:border-text-mute hover:text-text'}`}>
              ↗ {changed ? 'Share changes in chat' : 'Share to chat'}
            </button>
          )}
        </div>

        <WorkoutFields draft={d} onChange={set} showEstimate />
      </div>

      <div className="flex gap-2 border-t border-line p-4">
        <button onClick={onClear} className="flex-1 rounded-[12px] border border-missed/40 px-5 py-2.5 text-sm font-semibold text-missed transition hover:border-missed/60 hover:bg-missed/10">Clear day</button>
        <Button onClick={() => onSave(d)} className="flex-1">Done</Button>
      </div>
    </aside>
  )
}
