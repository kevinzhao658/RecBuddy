import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { LibraryWorkout, WorkoutType } from '../../lib/types'
import { useLibrary, useCreateLibraryWorkout, useUpdateLibraryWorkout, useDeleteLibraryWorkout } from '../../lib/queries/library'
import { TypeIcon } from '../../components/ui/Icon'
import { WORKOUT_TYPES, WORKOUT_TYPE_LABEL } from '../../components/ui/WorkoutFields'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'
import { LibraryEditor } from './LibraryEditor'

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
  const { unit } = useUnit()
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
        <div className="truncate font-semibold">{t.title}</div>
        {t.dist != null && <div className="font-num text-xs text-text-mute">{fmtDist(t.dist, unit)} {unit} · {fmtPace(t.pace, unit)}</div>}
        {setsLine && <div className="mt-0.5 truncate font-num text-[11px] text-text-faint">{setsLine}</div>}
      </div>
      <div className="flex shrink-0 gap-1.5 opacity-0 transition group-hover:opacity-100">
        <button aria-label="Edit workout" onClick={onEdit} className="text-text-faint hover:text-text"><PencilIcon /></button>
        <button aria-label="Delete workout" onClick={onDelete} className="text-text-faint hover:text-missed"><TrashIcon /></button>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-[9px] border px-2 py-0.5 text-xs font-medium transition ${
        active ? 'border-accent bg-surface2 text-accent' : 'border-line text-text-mute hover:border-text-mute'}`}>
      {children}
    </button>
  )
}

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string }

export function WorkoutLibrary() {
  const lib = useLibrary()
  const create = useCreateLibraryWorkout()
  const update = useUpdateLibraryWorkout()
  const del = useDeleteLibraryWorkout()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [filter, setFilter] = useState<WorkoutType | 'all'>('all')
  const close = () => setMode({ kind: 'list' })

  const items = lib.data ?? []
  const editing = mode.kind === 'edit' ? items.find((t) => t.id === mode.id) : null
  const shown = filter === 'all' ? items : items.filter((t) => t.type === filter)

  return (
    <aside className="rb-surface flex w-80 shrink-0 flex-col border-l border-line">
      {mode.kind === 'new' ? (
        <LibraryEditor busy={create.isPending} onCancel={close}
          onSave={(d) => create.mutate(d, { onSuccess: close })} />
      ) : editing ? (
        <LibraryEditor key={editing.id} initial={editing} busy={update.isPending} onCancel={close}
          onSave={(patch) => update.mutate({ id: editing.id, patch }, { onSuccess: close })}
          onDelete={() => del.mutate(editing.id, { onSuccess: close })} />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Workout library</span>
            <button onClick={() => setMode({ kind: 'new' })}
              className="rounded-[10px] border border-line bg-surface2 px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent/50">
              ＋ New workout
            </button>
          </div>

          {/* Quick filters — single type at a time, default All */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
            {WORKOUT_TYPES.map((t) => (
              <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>{WORKOUT_TYPE_LABEL[t]}</FilterChip>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="mb-2 px-1 text-[11px] text-text-faint">Drag any workout onto a day to schedule it.</p>
            <div className="flex flex-col gap-2">
              {shown.map((t) => (
                <LibraryCard key={t.id} t={t} onEdit={() => setMode({ kind: 'edit', id: t.id })} onDelete={() => del.mutate(t.id)} />
              ))}
              {shown.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-text-faint">
                  {items.length === 0
                    ? 'No workouts yet — create one to reuse across athletes.'
                    : `No ${WORKOUT_TYPE_LABEL[filter as WorkoutType].toLowerCase()} workouts.`}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
