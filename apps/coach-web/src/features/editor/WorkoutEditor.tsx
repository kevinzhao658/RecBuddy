import { useState } from 'react'
import type { Workout, WorkoutType } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { Button } from '../../components/ui/Button'
import type { WorkoutDraft } from '../../lib/queries/plan'

const TYPES: WorkoutType[] = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest']

export function WorkoutEditor({ date: _date, workout, onSave, onClear }: {
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
    <div className="flex w-80 flex-col gap-3 border-l border-line bg-surface p-4">
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => <button key={t} onClick={() => set({ type: t })}
          className={`rounded-[20px] px-2.5 py-1 text-xs ${d.type === t ? 'bg-accent text-on-accent' : 'bg-chip text-text-mute'}`}>{t}</button>)}
      </div>
      <label className="text-sm text-text-mute">Title
        <input aria-label="Title" value={d.title} onChange={(e) => set({ title: e.target.value })}
          className="mt-1 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" /></label>
      <div className="flex gap-2">
        <label className="flex-1 text-sm text-text-mute">Distance (mi)
          <input aria-label="Distance" type="number" value={d.dist ?? ''} onChange={(e) => set({ dist: e.target.value ? Number(e.target.value) : null })}
            className="mt-1 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" /></label>
        <label className="flex-1 text-sm text-text-mute">Pace
          <input aria-label="Pace" value={d.pace ?? ''} onChange={(e) => set({ pace: e.target.value || null })}
            className="mt-1 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" /></label>
      </div>
      <label className="text-sm text-text-mute">Est. time (min) — auto {autoEst}
        <input aria-label="Est minutes" type="number" placeholder={String(autoEst)} value={d.est_minutes ?? ''}
          onChange={(e) => set({ est_minutes: e.target.value ? Number(e.target.value) : null })}
          className="mt-1 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" /></label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-text-mute">Workout structure</span>
          <button aria-label="Add phase" onClick={() => set({ sets: [...d.sets, ['', '']] })} className="text-accent text-sm">+ Add phase</button>
        </div>
        {d.sets.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input aria-label={`Phase ${i + 1} label`} value={p[0]} onChange={(e) => editPhase(i, 0, e.target.value)} placeholder="Label"
              className="w-28 rounded-[10px] border border-line bg-surface2 px-2 py-1 text-sm text-text" />
            <input aria-label={`Phase ${i + 1} detail`} value={p[1]} onChange={(e) => editPhase(i, 1, e.target.value)} placeholder="Detail"
              className="flex-1 rounded-[10px] border border-line bg-surface2 px-2 py-1 text-sm text-text" />
            <button aria-label={`Remove phase ${i + 1}`} onClick={() => set({ sets: d.sets.filter((_, j) => j !== i) })} className="text-text-faint">✕</button>
          </div>
        ))}
      </div>

      <label className="text-sm text-text-mute">Coach's note
        <textarea aria-label="Note" value={d.note} onChange={(e) => set({ note: e.target.value })}
          className="mt-1 w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" rows={3} /></label>
      <div className="mt-auto flex justify-between">
        <Button variant="ghost" onClick={onClear}>Clear day</Button>
        <Button onClick={() => onSave(d)}>Done</Button>
      </div>
    </div>
  )
}
