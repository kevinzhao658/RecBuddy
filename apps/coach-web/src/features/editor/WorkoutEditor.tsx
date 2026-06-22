import { useState } from 'react'
import type { Workout, WorkoutType } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { fmtShortDate } from '../../lib/week'
import { Button } from '../../components/ui/Button'
import { TypeIcon } from '../../components/ui/Icon'
import { PaceField } from '../../components/ui/PaceField'
import type { WorkoutDraft } from '../../lib/queries/plan'

const TYPES: WorkoutType[] = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest']
const TYPE_LABEL: Record<WorkoutType, string> = {
  easy: 'Easy', long: 'Long', speed: 'Intervals', tempo: 'Tempo', recovery: 'Recovery', cross: 'Cross', rest: 'Rest', race: 'Race',
}
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const field = 'w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-[15px] text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const labelEyebrow = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

function eyebrow(iso: string) {
  const dt = new Date(iso + 'T00:00:00Z')
  if (isNaN(dt.getTime())) return iso
  return `${WEEKDAY[dt.getUTCDay()]} · ${fmtShortDate(iso)}`
}

export function WorkoutEditor({ date, workout, onSave, onClear }: {
  date: string; workout: Workout | null; onSave: (d: WorkoutDraft) => void; onClear: () => void
}) {
  const [d, setD] = useState<WorkoutDraft>(() => ({
    type: workout?.type ?? 'easy', title: workout?.title ?? 'Easy Run',
    dist: workout?.dist ?? 4, pace: workout?.pace ?? '9:30/mi',
    est_minutes: workout?.est_minutes ?? null, dur: workout?.dur ?? null,
    note: workout?.note ?? '', sets: workout?.sets ?? [],
  }))
  const set = (patch: Partial<WorkoutDraft>) => setD({ ...d, ...patch })
  const autoEst = estMinutes(d as Pick<Workout, 'type' | 'est_minutes' | 'dist' | 'pace' | 'dur'>)
  const editPhase = (i: number, which: 0 | 1, val: string) =>
    set({ sets: d.sets.map((p, j) => (j === i ? (which === 0 ? [val, p[1]] : [p[0], val]) : p)) })

  return (
    <aside className="rb-surface flex w-80 shrink-0 flex-col border-l border-line">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{workout ? 'Edit day' : 'New workout'}</p>
          <p className="font-display text-lg font-bold tracking-tight text-text">{eyebrow(date)}</p>
        </div>

        {/* Type chip grid */}
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t} onClick={() => set({ type: t })}
              className={`flex items-center gap-1 rounded-[9px] border px-2 py-1 text-xs font-medium transition ${
                d.type === t ? 'border-accent bg-surface2 text-accent' : 'border-line text-text-mute hover:border-text-mute'}`}>
              <TypeIcon type={t} className="h-3.5 w-3.5" />{TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div>
          <span className={labelEyebrow}>Title</span>
          <input aria-label="Title" value={d.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <span className={labelEyebrow}>Distance (mi)</span>
            <input aria-label="Distance" type="number" value={d.dist ?? ''} onChange={(e) => set({ dist: e.target.value ? Number(e.target.value) : null })} className={`${field} font-num`} />
          </div>
          <div className="flex-1">
            <span className={labelEyebrow}>Pace</span>
            <PaceField value={d.pace} onChange={(v) => set({ pace: v })} />
          </div>
        </div>

        <div>
          <span className={labelEyebrow}>Est. time (min) <span className="normal-case text-text-faint">— auto {autoEst}</span></span>
          <input aria-label="Est minutes" type="number" placeholder={String(autoEst)} value={d.est_minutes ?? ''}
            onChange={(e) => set({ est_minutes: e.target.value ? Number(e.target.value) : null })} className={`${field} font-num`} />
        </div>

        {/* Workout structure / phases */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Workout structure</span>
            <button aria-label="Add phase" onClick={() => set({ sets: [...d.sets, ['', '']] })} className="text-sm text-accent hover:brightness-110">+ Add phase</button>
          </div>
          {d.sets.length === 0 && <p className="text-xs text-text-faint">No phases — add intervals, warm-up or cool-down.</p>}
          {d.sets.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={`Phase ${i + 1} label`} value={p[0]} onChange={(e) => editPhase(i, 0, e.target.value)} placeholder="Label"
                className="w-28 rounded-[10px] border border-line bg-surface2 px-2 py-1.5 font-num text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
              <input aria-label={`Phase ${i + 1} detail`} value={p[1]} onChange={(e) => editPhase(i, 1, e.target.value)} placeholder="Detail"
                className="flex-1 rounded-[10px] border border-line bg-surface2 px-2 py-1.5 font-num text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none" />
              <button aria-label={`Remove phase ${i + 1}`} onClick={() => set({ sets: d.sets.filter((_, j) => j !== i) })} className="px-1 text-text-faint hover:text-missed">✕</button>
            </div>
          ))}
        </div>

        <div>
          <span className={labelEyebrow}>Coach's note</span>
          <textarea aria-label="Note" value={d.note} onChange={(e) => set({ note: e.target.value })} rows={3} className={`${field} resize-none`} />
        </div>
      </div>

      <div className="flex gap-2 border-t border-line p-4">
        <button onClick={onClear} className="flex-1 rounded-[12px] border border-missed/40 px-5 py-2.5 text-sm font-semibold text-missed transition hover:border-missed/60 hover:bg-missed/10">Clear day</button>
        <Button onClick={() => onSave(d)} className="flex-1">Done</Button>
      </div>
    </aside>
  )
}
