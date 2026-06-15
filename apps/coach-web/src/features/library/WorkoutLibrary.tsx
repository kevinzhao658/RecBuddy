import { useDraggable } from '@dnd-kit/core'
import type { LibraryWorkout } from '../../lib/types'
import { useLibrary, useCreateLibraryWorkout } from '../../lib/queries/library'
import { TypeIcon } from '../../components/ui/Icon'

function LibraryCard({ t }: { t: LibraryWorkout }) {
  const drag = useDraggable({ id: `lib:${t.id}` })
  return (
    <div ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}
      className="flex cursor-grab items-center gap-2 rounded-[14px] border border-line bg-surface p-3">
      <TypeIcon type={t.type} className="text-text-mute" />
      <span className="flex-1">
        <span className="block font-semibold">{t.title}</span>
        {t.dist != null && <span className="block text-xs text-text-mute">{t.dist} mi · {t.pace}</span>}
      </span>
      {t.custom && <span className="text-xs text-accent">custom</span>}
    </div>
  )
}

export function WorkoutLibrary() {
  const lib = useLibrary()
  const create = useCreateLibraryWorkout()
  return (
    <div className="flex w-80 flex-col gap-2 border-l border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-mute">Workout library</span>
        <button onClick={() => create.mutate({ type: 'easy', title: 'New Workout', dist: 5, pace: '9:30/mi', note: '', sets: [] })}
          disabled={create.isPending} className="text-sm text-accent">+ New workout</button>
      </div>
      {(lib.data ?? []).map((t) => <LibraryCard key={t.id} t={t} />)}
    </div>
  )
}
