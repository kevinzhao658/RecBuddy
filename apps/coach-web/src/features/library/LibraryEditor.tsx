import { useState } from 'react'
import type { LibraryWorkout } from '../../lib/types'
import type { LibraryDraft } from '../../lib/queries/library'
import { Button } from '../../components/ui/Button'
import { WorkoutFields, type WorkoutFieldsDraft } from '../../components/ui/WorkoutFields'

/** Full-panel library create/edit — the same view as editing a workout on a day
 *  (`WorkoutEditor`), minus the date/share/est-time bits the library has no use for. */
export function LibraryEditor({ initial, busy, onSave, onCancel, onDelete }: {
  initial?: LibraryWorkout | null; busy?: boolean
  onSave: (d: LibraryDraft) => void; onCancel: () => void; onDelete?: () => void
}) {
  const [d, setD] = useState<WorkoutFieldsDraft>(() => ({
    type: initial?.type ?? 'easy', title: initial?.title ?? '',
    dist: initial?.dist ?? null, pace: initial?.pace ?? null,
    note: initial?.note ?? '', sets: initial?.sets ?? [],
  }))
  const set = (patch: Partial<WorkoutFieldsDraft>) => setD({ ...d, ...patch })
  const save = () => {
    if (!d.title.trim()) return
    onSave({
      type: d.type, title: d.title.trim(),
      dist: d.dist, pace: d.pace?.trim() || null, note: d.note.trim() || null,
      sets: d.sets.filter(([a, b]) => a.trim() || b.trim()),
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{initial ? 'Edit workout' : 'New workout'}</p>
            <p className="font-display text-lg font-bold tracking-tight text-text">Library</p>
          </div>
          {onDelete && (
            <button onClick={onDelete} aria-label="Delete workout"
              className="mt-0.5 shrink-0 rounded-[9px] border border-line px-2 py-1 text-xs font-semibold text-text-mute transition hover:border-missed/60 hover:text-missed">
              Delete
            </button>
          )}
        </div>

        <WorkoutFields draft={d} onChange={set} />
      </div>

      <div className="flex gap-2 border-t border-line p-4">
        <button onClick={onCancel} className="flex-1 rounded-[12px] border border-line px-5 py-2.5 text-sm font-semibold text-text-mute transition hover:border-text-mute hover:text-text">Cancel</button>
        <Button onClick={save} disabled={busy || !d.title.trim()} className="flex-1">{initial ? 'Save changes' : 'Add to library'}</Button>
      </div>
    </div>
  )
}
