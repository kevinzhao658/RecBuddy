import { useState } from 'react'
import type { WorkoutType, LibraryWorkout } from '../../lib/types'
import type { LibraryDraft } from '../../lib/queries/library'
import { TypeIcon } from '../../components/ui/Icon'

const TYPES: WorkoutType[] = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest']
const TYPE_LABEL: Record<WorkoutType, string> = {
  easy: 'Easy', long: 'Long', speed: 'Intervals', tempo: 'Tempo', recovery: 'Recovery', cross: 'Cross', rest: 'Rest', race: 'Race',
}
const field = 'w-full rounded-[10px] border border-line bg-surface2 px-2.5 py-1.5 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'

export function LibraryForm({ initial, busy, onCancel, onSave }: {
  initial?: LibraryWorkout | null; busy?: boolean; onCancel: () => void; onSave: (d: LibraryDraft) => void
}) {
  const [type, setType] = useState<WorkoutType>(initial?.type ?? 'easy')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dist, setDist] = useState(initial?.dist != null ? String(initial.dist) : '')
  const [pace, setPace] = useState(initial?.pace ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [sets, setSets] = useState<[string, string][]>(initial?.sets ?? [])

  const setSet = (i: number, j: 0 | 1, v: string) => setSets((s) => s.map((row, k) => (k === i ? (j === 0 ? [v, row[1]] : [row[0], v]) : row)))
  const save = () => {
    if (!title.trim()) return
    onSave({
      type, title: title.trim(),
      dist: dist.trim() === '' ? null : Number(dist),
      pace: pace.trim() || null, note: note.trim() || null,
      sets: sets.filter(([a, b]) => a.trim() || b.trim()),
    })
  }

  return (
    <div className="rb-card rb-card-sm mb-3 flex flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`flex items-center gap-1 rounded-[9px] border px-2 py-1 text-xs font-medium transition ${
              type === t ? 'border-accent bg-surface2 text-accent' : 'border-line text-text-mute hover:border-text-mute'}`}>
            <TypeIcon type={t} className="h-3.5 w-3.5" />{TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Workout title" className={field} />

      <div className="flex gap-2">
        <input value={dist} onChange={(e) => setDist(e.target.value)} inputMode="decimal" placeholder="Distance (mi)" className={`${field} font-num`} />
        <input value={pace} onChange={(e) => setPace(e.target.value)} placeholder="Pace (8:30/mi)" className={`${field} font-num`} />
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes for the athlete (optional)" className={`${field} resize-none`} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">Intervals</span>
        {sets.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input value={row[0]} onChange={(e) => setSet(i, 0, e.target.value)} placeholder="5 × 800m" className={`${field} font-num`} />
            <input value={row[1]} onChange={(e) => setSet(i, 1, e.target.value)} placeholder="@ 5:40 / 2′ jog" className={`${field} font-num`} />
            <button aria-label="Remove interval" onClick={() => setSets((s) => s.filter((_, k) => k !== i))} className="px-1 text-text-faint hover:text-missed">✕</button>
          </div>
        ))}
        <button onClick={() => setSets((s) => [...s, ['', '']])} className="self-start text-xs text-accent hover:brightness-110">+ Add interval</button>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-3 py-1.5 text-sm text-text-mute hover:text-text">Cancel</button>
        <button onClick={save} disabled={busy || !title.trim()}
          className="rb-glow rounded-[10px] bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent disabled:opacity-50">
          {initial ? 'Save changes' : 'Add to library'}
        </button>
      </div>
    </div>
  )
}
