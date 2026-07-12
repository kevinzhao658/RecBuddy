import { useState } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Workout, WorkoutType } from '../../lib/types'
import { estMinutes, paceToSec, secToPace } from '../../lib/estMinutes'
import { TypeIcon } from './Icon'
import { GripIcon, TrashIcon } from './FormIcons'
import { PaceField } from './PaceField'
import { NumberField } from './NumberField'
import { useUnit } from '../../lib/useUnit'
import { fromMiles, toMiles } from '../../lib/units'

export const WORKOUT_TYPES: WorkoutType[] = ['easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest', 'other']
export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  easy: 'Easy', long: 'Long', speed: 'Intervals', tempo: 'Tempo', recovery: 'Recovery', cross: 'Cross', rest: 'Rest', race: 'Race', other: 'Other',
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

type Metric = 'dist' | 'pace' | 'time'
const METRICS: Metric[] = ['dist', 'pace', 'time']

export function WorkoutFields({ draft: d, onChange, disabled = false }: {
  draft: WorkoutFieldsDraft; onChange: (patch: Partial<WorkoutFieldsDraft>) => void; disabled?: boolean
}) {
  const set = disabled ? () => {} : onChange
  const { unit } = useUnit()
  const autoEst = estMinutes({ ...d, est_minutes: d.est_minutes ?? null, dur: d.dur ?? null } as Pick<Workout, 'type' | 'est_minutes' | 'dist' | 'pace' | 'dur'>)
  const editPhase = (i: number, which: 0 | 1, val: string) =>
    set({ sets: d.sets.map((p, j) => (j === i ? (which === 0 ? [val, p[1]] : [p[0], val]) : p)) })

  // 'other' workouts carry no metrics — just title, phases, and the note.
  const hasMetrics = d.type !== 'other'

  // ── Distance · pace · total time: edit any two, the third solves itself ──
  // The two most-recently edited fields are authoritative; the remaining one
  // recomputes from them on every keystroke (dist × pace = time).
  const [touched, setTouched] = useState<Metric[]>([])
  const derived = touched.length === 2 ? METRICS.find((f) => !touched.includes(f)) : null
  const editMetric = (field: Metric, patch: Partial<WorkoutFieldsDraft>) => {
    const order = [field, ...touched.filter((f) => f !== field)].slice(0, 2)
    setTouched(order)
    const third = METRICS.find((f) => !order.includes(f))
    if (order.length === 2 && third) {
      const nd = { ...d, ...patch }
      const paceSec = paceToSec(nd.pace)
      const mins = nd.est_minutes
      if (third === 'time' && nd.dist && paceSec > 0) {
        patch.est_minutes = Math.round((nd.dist * paceSec) / 60)
      } else if (third === 'pace' && nd.dist && mins != null && mins > 0) {
        patch.pace = secToPace((mins * 60) / nd.dist)
      } else if (third === 'dist' && mins != null && mins > 0 && paceSec > 0) {
        patch.dist = Math.round(((mins * 60) / paceSec) * 100) / 100
      }
    }
    set(patch)
  }
  /** '· auto' eyebrow suffix on the field the other two are computing. */
  const autoTag = (f: Metric) =>
    derived === f ? <span className="normal-case tracking-normal text-accent"> · auto</span> : null

  return (
    <div className={disabled ? 'opacity-80' : undefined}>
      <fieldset disabled={disabled} className="flex flex-col gap-3 min-w-0">
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

        {hasMetrics && (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className={labelEyebrow}>Distance ({unit}){autoTag('dist')}</span>
                <NumberField ariaLabel="Distance" step={0.5}
                  value={d.dist != null ? Math.round(fromMiles(d.dist, unit) * 10) / 10 : null}
                  onChange={(v) => editMetric('dist', { dist: v != null ? Math.round(toMiles(v, unit) * 100) / 100 : null })} />
              </div>
              <div className="flex-1">
                <span className={labelEyebrow}>Pace{autoTag('pace')}</span>
                <PaceField value={d.pace} onChange={(v) => editMetric('pace', { pace: v })} unit={unit} />
              </div>
            </div>

            <div>
              <span className={labelEyebrow}>Total time (min){autoTag('time')} <span className="normal-case text-text-faint">— auto {autoEst}</span></span>
              <input aria-label="Total time" type="number" placeholder={String(autoEst)} value={d.est_minutes ?? ''}
                onChange={(e) => editMetric('time', { est_minutes: e.target.value ? Number(e.target.value) : null })} className={`${field} font-num`} />
            </div>
          </>
        )}

        {/* Workout structure / phases */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text-mute">Workout structure</span>
            <button aria-label="Add phase" onClick={() => set({ sets: [...d.sets, ['', '']] })} className="text-sm text-accent hover:brightness-110">+ Add phase</button>
          </div>
          {d.sets.length === 0 && <p className="text-xs text-text-faint">No phases — add intervals, warm-up or cool-down.</p>}
          <PhaseList sets={d.sets} editPhase={editPhase}
            onReorder={(from, to) => set({ sets: arrayMove(d.sets, from, to) })}
            onRemove={(i) => set({ sets: d.sets.filter((_, j) => j !== i) })} />
        </div>

        <div>
          <span className={labelEyebrow}>Coach's note</span>
          <textarea aria-label="Note" value={d.note} onChange={(e) => set({ note: e.target.value })} rows={3} className={`${field} resize-none`} />
        </div>
      </fieldset>
    </div>
  )
}

// ── Phases: sortable list ─────────────────────────────────────────────────────
// Drag by the grip to reorder. Neighbors slide out of the way and the vacated
// slot renders as a dashed volt placeholder that travels to where the phase
// will land; a lifted copy of the row follows the pointer (DragOverlay).
// Nested DndContext: phases are their own drag world — the outer CoachPage
// context (library -> day cards) never sees these events.

const phaseField = 'rounded-[10px] border border-line bg-surface2 px-2 py-1.5 font-num text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'

function PhaseList({ sets, editPhase, onReorder, onRemove }: {
  sets: [string, string][]
  editPhase: (i: number, which: 0 | 1, val: string) => void
  onReorder: (from: number, to: number) => void
  onRemove: (i: number) => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const ids = sets.map((_, i) => `phase-${i}`)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  if (sets.length === 0) return null
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={(e) => setDragIdx(ids.indexOf(String(e.active.id)))}
      onDragCancel={() => setDragIdx(null)}
      onDragEnd={({ active, over }) => {
        setDragIdx(null)
        if (over && active.id !== over.id) onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
      }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {sets.map((p, i) => (
          <SortablePhaseRow key={ids[i]} id={ids[i]} i={i} p={p} editPhase={editPhase} onRemove={onRemove} />
        ))}
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {dragIdx != null && sets[dragIdx] && (
          <div className="flex items-center gap-2 rounded-[10px] border border-accent bg-surface2 shadow-lg shadow-accent/25">
            <PhaseRowBody i={dragIdx} p={sets[dragIdx]} ghost />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function SortablePhaseRow({ id, i, p, editPhase, onRemove }: {
  id: string; i: number; p: [string, string]
  editPhase: (i: number, which: 0 | 1, val: string) => void
  onRemove: (i: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-[10px] border ${
        isDragging ? 'border-dashed border-accent bg-accent/10' : 'border-transparent'}`}>
      {/* While dragging, the row's contents go invisible so this slot reads as
          the placeholder; the visible copy rides in the DragOverlay. */}
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${isDragging ? 'invisible' : ''}`}>
        <PhaseRowBody i={i} p={p} editPhase={editPhase} onRemove={onRemove}
          handleProps={{ ...attributes, ...listeners }} />
      </div>
    </div>
  )
}

/** Row contents, shared by the live row and the drag-overlay copy (`ghost`). */
function PhaseRowBody({ i, p, editPhase, onRemove, handleProps, ghost = false }: {
  i: number; p: [string, string]
  editPhase?: (i: number, which: 0 | 1, val: string) => void
  onRemove?: (i: number) => void
  handleProps?: Record<string, unknown>
  ghost?: boolean
}) {
  return (
    <>
      <button type="button" {...handleProps} aria-label={ghost ? undefined : `Reorder phase ${i + 1}`}
        className={`shrink-0 rounded p-1 text-text-faint ${ghost ? '' : 'cursor-grab touch-none hover:text-text-mute active:cursor-grabbing'}`}>
        <GripIcon className="h-4 w-4" />
      </button>
      <input aria-label={ghost ? undefined : `Phase ${i + 1} label`} value={p[0]} placeholder="Label"
        readOnly={ghost} onChange={(e) => editPhase?.(i, 0, e.target.value)}
        className={`w-24 shrink-0 ${phaseField}`} />
      <input aria-label={ghost ? undefined : `Phase ${i + 1} detail`} value={p[1]} placeholder="Detail"
        readOnly={ghost} onChange={(e) => editPhase?.(i, 1, e.target.value)}
        className={`min-w-0 flex-1 ${phaseField}`} />
      <button type="button" aria-label={ghost ? undefined : `Remove phase ${i + 1}`} onClick={() => onRemove?.(i)}
        className="shrink-0 rounded-md p-1.5 text-text-mute hover:bg-surface2 hover:text-missed">
        <TrashIcon className="h-4 w-4" />
      </button>
    </>
  )
}
