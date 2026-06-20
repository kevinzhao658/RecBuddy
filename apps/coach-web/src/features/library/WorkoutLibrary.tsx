import { useDraggable } from '@dnd-kit/core'
import type { LibraryWorkout } from '../../lib/types'
import { useLibrary, useCreateLibraryWorkout } from '../../lib/queries/library'
import { TypeIcon } from '../../components/ui/Icon'

function LibraryCard({ t }: { t: LibraryWorkout }) {
  const drag = useDraggable({ id: `lib:${t.id}` })
  return (
    <div ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
      className="rb-card rb-card-sm flex cursor-grab items-center gap-2 p-3">
      <TypeIcon type={t.type} className="text-text-mute" />
      <span className="flex-1">
        <span className="block font-semibold">{t.title}</span>
        {t.dist != null && <span className="block font-num text-xs text-text-mute">{t.dist} mi · {t.pace}</span>}
      </span>
      {t.custom && <span className="text-xs text-accent">custom</span>}
    </div>
  )
}

export function WorkoutLibrary() {
  const lib = useLibrary()
  const create = useCreateLibraryWorkout()
  return (
    <div className="rb-surface flex w-80 flex-col gap-2 border-l border-line p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Workout library</span>
        <button onClick={() => create.mutate({ type: 'easy', title: 'New Workout', dist: 5, pace: '9:30/mi', note: '', sets: [] })}
          disabled={create.isPending} className="text-sm text-accent hover:brightness-110 disabled:opacity-50">+ New workout</button>
      </div>
      {(lib.data ?? []).map((t) => <LibraryCard key={t.id} t={t} />)}
    </div>
  )
}
