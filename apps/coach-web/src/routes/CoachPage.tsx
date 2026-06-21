import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { RosterSidebar } from '../features/roster/RosterSidebar'
import { TopBar } from '../features/plan-grid/TopBar'
import { WeekStats } from '../features/plan-grid/WeekStats'
import { WeekGrid } from '../features/plan-grid/WeekGrid'
import { WorkoutKey } from '../features/plan-grid/WorkoutKey'
import { WorkoutEditor } from '../features/editor/WorkoutEditor'
import { WorkoutLibrary } from '../features/library/WorkoutLibrary'
import { TeamPopover } from '../features/team/TeamPopover'
import { Toast } from '../components/ui/Toast'
import { useRoster } from '../lib/queries/roster'
import { useTeam } from '../lib/queries/team'
import { useLibrary } from '../lib/queries/library'
import { useAthletePlan, useUpsertWorkout, useClearDay, useMoveWorkout, usePasteWorkout, useDuplicateWeek } from '../lib/queries/plan'
import { useClipboard } from '../features/plan-grid/useClipboard'
import { useRealtimePlan } from '../lib/useRealtimePlan'
import { mondayOf, addDays, fmtShortDate } from '../lib/week'
import { useAuth } from '../auth/AuthProvider'
import type { Workout } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)

function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

export default function CoachPage() {
  const { session } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [monday, setMonday] = useState<string>(() => mondayOf(todayISO()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clipboard = useClipboard()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200) }

  return (
    <div className="flex min-h-screen">
      <RosterSidebar selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedDate(null) }} />
      {selectedId
        ? <AthleteDashboard
            key={selectedId} athleteId={selectedId} coachId={session!.user.id}
            monday={monday} setMonday={setMonday}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            clipboard={clipboard} sensors={sensors} flash={flash} />
        : <main className="grid flex-1 place-items-center px-6 py-32 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Roster</p>
              <p className="mt-3 text-lg text-text-mute">Select an athlete</p>
              <p className="mt-1 text-sm text-text-faint">Pick someone from the roster to build their week.</p>
            </div>
          </main>}
      <Toast message={toast} />
    </div>
  )
}

function AthleteDashboard({ athleteId, coachId, monday, setMonday, selectedDate, setSelectedDate, clipboard, sensors, flash }: {
  athleteId: string; coachId: string; monday: string; setMonday: (m: string) => void
  selectedDate: string | null; setSelectedDate: (d: string | null) => void
  clipboard: ReturnType<typeof useClipboard>; sensors: ReturnType<typeof useSensors>; flash: (m: string) => void
}) {
  useRealtimePlan(athleteId)
  const roster = useRoster()
  const team = useTeam(athleteId)
  const library = useLibrary()
  const planQ = useAthletePlan(athleteId, monday)
  const upsert = useUpsertWorkout(athleteId, monday)
  const clearDay = useClearDay(athleteId, monday)
  const move = useMoveWorkout(athleteId, monday)
  const paste = usePasteWorkout(athleteId, monday)
  const duplicate = useDuplicateWeek(athleteId, monday)

  const entry = (roster.data ?? []).find((r) => r.athlete.id === athleteId)
  const week = planQ.data ?? Array(7).fill(null)
  const isHead = (team.data ?? []).some((m) => m.coach_id === coachId && m.relationship === 'head')
  const isThisWeek = monday === mondayOf(todayISO())
  const selectedWorkout = selectedDate ? (week.find((w) => w?.date === selectedDate) ?? null) : null

  const onDragEnd = (e: DragEndEvent) => {
    const from = String(e.active.id); const to = e.over ? String(e.over.id) : null
    if (!to) return
    if (from.startsWith('lib:')) {
      const tpl = (library.data ?? []).find((t) => `lib:${t.id}` === from)
      if (tpl) paste.mutate({ date: to, source: tpl as unknown as Workout }, { onError: (err: any) => flash(err.message) })
    } else if (from !== to) {
      move.mutate({ from, to }, { onError: (err: any) => flash(err.message) })
    }
  }

  if (!entry) return <main className="flex-1 p-6 text-text-mute">Loading…</main>

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <main className="flex min-h-screen min-w-0 flex-1">
        {/* Center column: identity, controls, the week grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            athlete={entry.athlete}
            plan={entry.plans?.[0] ?? null}
            actions={
              <>
                <TeamPopover athleteId={athleteId} isHead={isHead} />
                <button disabled title="Chat ships in a later release"
                  className="flex items-center gap-1.5 rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-55">
                  <ChatIcon className="h-4 w-4" /> Message
                </button>
                <button onClick={() => duplicate.mutate(undefined, { onSuccess: () => flash('Week duplicated to next week'), onError: (err: any) => flash(err.message) })}
                  className="flex items-center gap-1.5 rounded-[12px] border border-line bg-surface2 px-4 py-2 text-sm font-semibold text-text hover:border-text-mute">
                  <span className="text-accent">＋</span> Duplicate week
                </button>
              </>
            }
          />

          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-4">
              <div className="inline-flex rounded-[10px] bg-surface2 p-1">
                <span className="rounded-[8px] bg-surface px-4 py-1.5 text-sm font-semibold text-text shadow-sm">Week</span>
                <button disabled title="Month view coming next" className="rounded-[8px] px-4 py-1.5 text-sm font-medium text-text-faint">Month</button>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))} className="text-2xl leading-none text-text-mute hover:text-text">‹</button>
                <span className="font-num text-sm font-medium tabular-nums text-text">{fmtShortDate(monday)} – {fmtShortDate(addDays(monday, 6))}</span>
                <button aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))} className="text-2xl leading-none text-text-mute hover:text-text">›</button>
                {isThisWeek && <span className="ml-1 text-xs text-text-faint">This week</span>}
              </div>
            </div>
            <WeekStats week={week} />
          </div>

          <div className="flex-1 px-6 pb-6">
            <WeekGrid monday={monday} week={week} selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d)}
              onCopy={(w) => { clipboard.copy(w); flash('Workout copied') }}
              canPaste={!!clipboard.clip}
              onPaste={(d) => clipboard.clip && paste.mutate({ date: d, source: clipboard.clip }, { onError: (err: any) => flash(err.message) })} />
            <WorkoutKey />
            <p className="mt-3 px-1 text-xs text-text-faint">Drag from the workout library or move cards between days · Click any day to edit</p>
          </div>
        </div>

        {/* Right column: editor (a day is selected) or the library — full height */}
        {selectedDate
          ? <WorkoutEditor key={selectedDate} date={selectedDate} workout={selectedWorkout}
              onSave={(draft) => { upsert.mutate({ date: selectedDate, draft }, { onSuccess: () => setSelectedDate(null), onError: (err: any) => flash(err.message) }) }}
              onClear={() => { clearDay.mutate(selectedDate, { onSuccess: () => setSelectedDate(null), onError: (err: any) => flash(err.message) }) }} />
          : <WorkoutLibrary />}
      </main>
    </DndContext>
  )
}
