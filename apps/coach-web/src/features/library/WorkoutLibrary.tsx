import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { LibraryWorkout } from '../../lib/types'
import { useLibrary, useCreateLibraryWorkout, useUpdateLibraryWorkout, useDeleteLibraryWorkout } from '../../lib/queries/library'
import { TypeIcon } from '../../components/ui/Icon'
import { LibraryForm } from './LibraryForm'

function GripIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
}
function PencilIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
}
function TrashIcon({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
}

function LibraryCard({ t, onEdit, onDelete }: { t: LibraryWorkout; onEdit: () => void; onDelete: () => void }) {
  const drag = useDraggable({ id: `lib:${t.id}` })
  const setsLine = (t.sets ?? []).map((s) => s[0]).filter(Boolean).join(' · ')
  return (
    <div ref={drag.setNodeRef} className={`rb-card rb-card-sm group flex items-start gap-2 p-3 ${drag.isDragging ? 'opacity-40' : ''}`}>
      <button {...drag.attributes} {...drag.listeners} aria-label="Drag workout"
        className="mt-0.5 cursor-grab text-text-faint active:cursor-grabbing">
        <GripIcon />
      </button>
      <TypeIcon type={t.type} className="mt-0.5 shrink-0 text-text-mute" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{t.title}</span>
          {t.custom && <span className="rounded bg-surface2 px-1 text-[10px] font-semibold uppercase tracking-wide text-accent">custom</span>}
        </div>
        {t.dist != null && <div className="font-num text-xs text-text-mute">{t.dist} mi · {t.pace}</div>}
        {setsLine && <div className="mt-0.5 truncate font-num text-[11px] text-text-faint">{setsLine}</div>}
      </div>
      {t.custom && (
        <div className="flex shrink-0 gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button aria-label="Edit workout" onClick={onEdit} className="text-text-faint hover:text-text"><PencilIcon /></button>
          <button aria-label="Delete workout" onClick={onDelete} className="text-text-faint hover:text-missed"><TrashIcon /></button>
        </div>
      )}
    </div>
  )
}

type Mode = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; id: string }

export function WorkoutLibrary() {
  const lib = useLibrary()
  const create = useCreateLibraryWorkout()
  const update = useUpdateLibraryWorkout()
  const del = useDeleteLibraryWorkout()
  const [mode, setMode] = useState<Mode>({ kind: 'none' })
  const close = () => setMode({ kind: 'none' })

  const items = lib.data ?? []
  return (
    <aside className="rb-surface flex w-80 shrink-0 flex-col border-l border-line">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Workout library</span>
        <button onClick={() => setMode(mode.kind === 'new' ? { kind: 'none' } : { kind: 'new' })}
          className="rounded-[10px] border border-line bg-surface2 px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent/50">
          {mode.kind === 'new' ? 'Close' : '＋ New workout'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {mode.kind === 'new' && (
          <LibraryForm busy={create.isPending} onCancel={close}
            onSave={(d) => create.mutate(d, { onSuccess: close })} />
        )}

        <p className="mb-2 px-1 text-[11px] text-text-faint">Drag any workout onto a day to schedule it.</p>

        <div className="flex flex-col gap-2">
          {items.map((t) =>
            mode.kind === 'edit' && mode.id === t.id ? (
              <LibraryForm key={t.id} initial={t} busy={update.isPending} onCancel={close}
                onSave={(patch) => update.mutate({ id: t.id, patch }, { onSuccess: close })} />
            ) : (
              <LibraryCard key={t.id} t={t} onEdit={() => setMode({ kind: 'edit', id: t.id })} onDelete={() => del.mutate(t.id)} />
            ),
          )}
          {items.length === 0 && mode.kind !== 'new' && (
            <p className="px-1 py-6 text-center text-sm text-text-faint">No workouts yet — create one to reuse across athletes.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
