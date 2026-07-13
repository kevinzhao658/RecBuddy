import { useState } from 'react'
import type { Workout } from '../../lib/types'
import { useActual } from '../../lib/queries/actuals'
import { fmtShortDate } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'
import { WorkoutFields } from '../../components/ui/WorkoutFields'

const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

/** Effort face matching the athlete app's FaceIcon (laugh/smile/frown line art). */
function FaceGlyph({ feel, className = '' }: { feel: number; className?: string }) {
  const mouth = feel <= 2
    ? <path d="M8.5 13a3.5 3.5 0 007 0z" fill="currentColor" stroke="none" />         // laugh: open mouth
    : feel === 3
      ? <path d="M8.5 14a4.5 4.5 0 007 0" />                                          // smile
      : <path d="M8.5 16.5a4.5 4.5 0 017 0" />                                        // frown
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.8" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="9" r="0.9" fill="currentColor" stroke="none" />
      {mouth}
    </svg>
  )
}
const feelLabel = (feel: number) => (feel <= 2 ? 'Easy' : feel === 3 ? 'Moderate' : 'Hard')

/** Right-rail panel for a COMPLETED workout: read-only, defaults to the
 *  athlete's logged RESULTS with a toggle to the prescribed PLAN. */
export function WorkoutResults({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [tab, setTab] = useState<'results' | 'plan'>('results')
  const { unit } = useUnit()
  const actual = useActual(workout.id)

  return (
    <aside className="rb-surface flex h-full w-80 shrink-0 flex-col border-l border-line">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Completed</p>
          <p className="font-display text-lg font-bold tracking-tight text-text">{fmtShortDate(workout.date)} · {workout.title}</p>
        </div>

        {/* Results | Plan toggle */}
        <div className="inline-flex self-start rounded-[10px] bg-surface2 p-1">
          {(['results', 'plan'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-[8px] px-4 py-1.5 text-sm capitalize transition ${tab === t ? 'bg-surface font-semibold text-text shadow-sm' : 'font-medium text-text-faint hover:text-text'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'results' ? (
          actual.isLoading ? (
            <p className="text-sm text-text-faint">Loading results…</p>
          ) : actual.data ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {actual.data.dist != null && (
                  <div className="rb-card rb-card-sm p-3">
                    <span className={label}>Distance</span>
                    <span className="font-num text-lg font-bold">{fmtDist(actual.data.dist, unit)} {unit}</span>
                  </div>
                )}
                {actual.data.pace && (
                  <div className="rb-card rb-card-sm p-3">
                    <span className={label}>Avg pace</span>
                    <span className="font-num text-lg font-bold">{fmtPace(actual.data.pace, unit)}</span>
                  </div>
                )}
                {actual.data.time && (
                  <div className="rb-card rb-card-sm p-3">
                    <span className={label}>Time</span>
                    <span className="font-num text-lg font-bold">{actual.data.time}</span>
                  </div>
                )}
                {actual.data.hr != null && (
                  <div className="rb-card rb-card-sm p-3">
                    <span className={label}>Avg HR</span>
                    <span className="font-num text-lg font-bold">{actual.data.hr}</span>
                  </div>
                )}
              </div>
              {actual.data.feel != null && (
                <div className="flex items-center gap-2">
                  <FaceGlyph feel={actual.data.feel} className="text-accent" />
                  <span className="text-sm font-semibold">{feelLabel(actual.data.feel)} effort</span>
                </div>
              )}
              {actual.data.note && (
                <div>
                  <span className={label}>Athlete's comment</span>
                  <p className="rounded-[12px] border border-line bg-surface2 p-3 text-sm">{actual.data.note}</p>
                </div>
              )}
              <p className="text-xs text-text-faint">Source: {actual.data.source}</p>
            </>
          ) : (
            <p className="text-sm text-text-faint">Marked complete without logged details.</p>
          )
        ) : (
          /* Plan tab — the prescription, rendered via the locked edit module */
          <>
            <WorkoutFields
              draft={{
                type: workout.type,
                title: workout.title,
                dist: workout.dist,
                pace: workout.pace,
                note: workout.note ?? '',
                sets: workout.sets,
                est_minutes: workout.est_minutes,
                dur: workout.dur,
              }}
              onChange={() => {}}
              disabled
            />
            <p className="text-xs text-text-faint">Completed workouts can't be edited.</p>
          </>
        )}
      </div>

      <div className="border-t border-line p-4">
        <button onClick={onClose} className="w-full rounded-[12px] border border-line px-5 py-2.5 text-sm font-semibold text-text-mute transition hover:border-text-mute hover:text-text">Close</button>
      </div>
    </aside>
  )
}
