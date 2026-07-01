import type { Workout, WorkoutType } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { TypeIcon } from './Icon'
import { PaceField } from './PaceField'
import { NumberField } from './NumberField'
import { useUnit } from '../../lib/useUnit'
import { fromMiles, toMiles } from '../../lib/units'

export const WORKOUT_TYPES: WorkoutType[] = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest']
export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  easy: 'Easy', long: 'Long', speed: 'Intervals', tempo: 'Tempo', recovery: 'Recovery', cross: 'Cross', rest: 'Rest', race: 'Race',
}
const field = 'w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-[15px] text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const labelEyebrow = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

/** The shared workout form body — type, title, unit-aware distance/pace, optional
 *  est-time, structure phases, and note. Used by both the day editor
 *  (`WorkoutEditor`) and the library editor so the two stay identical. */
export type WorkoutFieldsDraft = {
  type: WorkoutType; title: string; dist: number | null; pace: string | null
  note: string; sets: [string, string][]; est_minutes?: number | null; dur?: number | null
}

export function WorkoutFields({ draft: d, onChange: set, showEstimate = false }: {
  draft: WorkoutFieldsDraft; onChange: (patch: Partial<WorkoutFieldsDraft>) => void; showEstimate?: boolean
}) {
  const { unit } = useUnit()
  const autoEst = estMinutes({ ...d, est_minutes: d.est_minutes ?? null, dur: d.dur ?? null } as Pick<Workout, 'type' | 'est_minutes' | 'dist' | 'pace' | 'dur'>)
  const editPhase = (i: number, which: 0 | 1, val: string) =>
    set({ sets: d.sets.map((p, j) => (j === i ? (which === 0 ? [val, p[1]] : [p[0], val]) : p)) })

  return (
    <>
      {/* Type chip grid */}
      <div className="flex flex-wrap gap-1.5">
        {WORKOUT_TYPES.map((t) => (
          <button key={t} onClick={() => set({ type: t })}
            className={`flex items-center gap-1 rounded-[9px] border px-2 py-1 text-xs font-medium transition ${
              d.type === t ? 'border-accent bg-surface2 text-accent' : 'border-line text-text-mute hover:border-text-mute'}`}>
            <TypeIcon type={t} className="h-3.5 w-3.5" />{WORKOUT_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div>
        <span className={labelEyebrow}>Title</span>
        <input aria-label="Title" value={d.title} onChange={(e) => set({ title: e.target.value })} className={field} />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <span className={labelEyebrow}>Distance ({unit})</span>
          <NumberField ariaLabel="Distance" step={0.5}
            value={d.dist != null ? Math.round(fromMiles(d.dist, unit) * 10) / 10 : null}
            onChange={(v) => set({ dist: v != null ? Math.round(toMiles(v, unit) * 100) / 100 : null })} />
        </div>
        <div className="flex-1">
          <span className={labelEyebrow}>Pace</span>
          <PaceField value={d.pace} onChange={(v) => set({ pace: v })} unit={unit} />
        </div>
      </div>

      {showEstimate && (
        <div>
          <span className={labelEyebrow}>Est. time (min) <span className="normal-case text-text-faint">— auto {autoEst}</span></span>
          <input aria-label="Est minutes" type="number" placeholder={String(autoEst)} value={d.est_minutes ?? ''}
            onChange={(e) => set({ est_minutes: e.target.value ? Number(e.target.value) : null })} className={`${field} font-num`} />
        </div>
      )}

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
    </>
  )
}
