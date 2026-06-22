import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { RosterSidebar } from '../features/roster/RosterSidebar'
import { TopBar } from '../features/plan-grid/TopBar'
import { PlanToolbar, type PlanView } from '../features/plan-grid/PlanToolbar'
import { WeekGrid } from '../features/plan-grid/WeekGrid'
import { MonthGrid } from '../features/plan-grid/MonthGrid'
import { WorkoutKey } from '../features/plan-grid/WorkoutKey'
import { DragGhost } from '../features/plan-grid/DragGhost'
import { useAthleteDnd } from '../features/plan-grid/useAthleteDnd'
import { WorkoutEditor } from '../features/editor/WorkoutEditor'
import { WorkoutLibrary } from '../features/library/WorkoutLibrary'
import { TeamPopover } from '../features/team/TeamPopover'
import { Toast } from '../components/ui/Toast'
import { useRoster } from '../lib/queries/roster'
import { useTeam } from '../lib/queries/team'
import { useLibrary } from '../lib/queries/library'
import { useAthletePlan, useAthleteMonth, useUpsertWorkout, useClearDay, useMoveWorkout, usePasteWorkout, useDuplicateWeek } from '../lib/queries/plan'
import { useClipboard } from '../features/plan-grid/useClipboard'
import { useRealtimePlan } from '../lib/useRealtimePlan'
import { mondayOf, addDays, fmtShortDate, firstOfMonth, addMonths, fmtMonthYear } from '../lib/week'
import { useAuth } from '../auth/AuthProvider'

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
  const [monthAnchor, setMonthAnchor] = useState<string>(() => firstOfMonth(todayISO()))
  const [view, setView] = useState<PlanView>('week')
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
            monday={monday} setMonday={setMonday} monthAnchor={monthAnchor} setMonthAnchor={setMonthAnchor}
            view={view} setView={setView}
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

function AthleteDashboard({ athleteId, coachId, monday, setMonday, monthAnchor, setMonthAnchor, view, setView, selectedDate, setSelectedDate, clipboard, sensors, flash }: {
  athleteId: string; coachId: string
  monday: string; setMonday: (m: string) => void
  monthAnchor: string; setMonthAnchor: (m: string) => void
  view: PlanView; setView: (v: PlanView) => void
  selectedDate: string | null; setSelectedDate: (d: string | null) => void
  clipboard: ReturnType<typeof useClipboard>; sensors: ReturnType<typeof useSensors>; flash: (m: string) => void
}) {
  useRealtimePlan(athleteId)
  const roster = useRoster()
  const team = useTeam(athleteId)
  const library = useLibrary()
  const planQ = useAthletePlan(athleteId, monday)
  const monthQ = useAthleteMonth(athleteId, monthAnchor, view === 'month')
  const upsert = useUpsertWorkout(athleteId, monday)
  const clearDay = useClearDay(athleteId, monday)
  const move = useMoveWorkout(athleteId, monday)
  const paste = usePasteWorkout(athleteId, monday)
  const duplicate = useDuplicateWeek(athleteId, monday)

  const entry = (roster.data ?? []).find((r) => r.athlete.id === athleteId)
  const week = planQ.data ?? Array(7).fill(null)
  const isHead = (team.data ?? []).some((m) => m.coach_id === coachId && m.relationship === 'head')
  const selectedWorkout = selectedDate ? (week.find((w) => w?.date === selectedDate) ?? null) : null

  const onError = (err: any) => flash(err.message)
  const dnd = useAthleteDnd({
    week, library: library.data,
    onPasteTemplate: (date, tpl) => paste.mutate({ date, source: tpl }, { onError }),
    onMove: (from, to) => move.mutate({ from, to }, { onError }),
  })

  const goMonth = () => { setMonthAnchor(firstOfMonth(monday)); setView('month') }
  const prev = () => view === 'week' ? setMonday(addDays(monday, -7)) : setMonthAnchor(addMonths(monthAnchor, -1))
  const next = () => view === 'week' ? setMonday(addDays(monday, 7)) : setMonthAnchor(addMonths(monthAnchor, 1))
  // From the month overview, clicking a day jumps to that week's editor.
  const pickMonthDay = (date: string) => { setMonday(mondayOf(date)); setSelectedDate(date); setView('week') }

  if (!entry) return <main className="flex-1 p-6 text-text-mute">Loading…</main>

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd}>
      <main className="flex min-h-screen min-w-0 flex-1">
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
                <button onClick={() => duplicate.mutate(undefined, { onSuccess: () => flash('Week duplicated to next week'), onError })}
                  className="flex items-center gap-1.5 rounded-[12px] border border-line bg-surface2 px-4 py-2 text-sm font-semibold text-text hover:border-text-mute">
                  <span className="text-accent">＋</span> Duplicate week
                </button>
              </>
            }
          />

          <PlanToolbar
            view={view} onWeek={() => setView('week')} onMonth={goMonth} onPrev={prev} onNext={next}
            label={view === 'week' ? `${fmtShortDate(monday)} – ${fmtShortDate(addDays(monday, 6))}` : fmtMonthYear(monthAnchor)}
            isCurrent={view === 'week' ? monday === mondayOf(todayISO()) : monthAnchor === firstOfMonth(todayISO())}
            week={week} />

          {view === 'week' ? (
            // Clicking blank space exits the editor (day cards stop propagation)
            <div className="flex-1 px-6 pb-6" onClick={() => selectedDate && setSelectedDate(null)}>
              <WeekGrid monday={monday} week={week} selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onCopy={(w) => { clipboard.copy(w); flash('Workout copied') }}
                canPaste={!!clipboard.clip}
                onPaste={(d) => clipboard.clip && paste.mutate({ date: d, source: clipboard.clip }, { onError })} />
              <WorkoutKey />
              <p className="mt-3 px-1 text-xs text-text-faint">Drag from the workout library or move cards between days · Click any day to edit</p>
            </div>
          ) : (
            <div className="flex-1 px-6 pb-6">
              <MonthGrid anchor={monthAnchor} byDate={monthQ.data ?? {}} selectedDate={selectedDate} onPick={pickMonthDay} />
              <p className="mt-3 px-1 text-xs text-text-faint">Click any day to open that week and edit it.</p>
            </div>
          )}
        </div>

        {/* Right column: week view shows the editor (a day is selected) or the library */}
        {view === 'week' && (selectedDate
          ? <WorkoutEditor key={selectedDate} date={selectedDate} workout={selectedWorkout}
              onSave={(draft) => { upsert.mutate({ date: selectedDate, draft }, { onSuccess: () => setSelectedDate(null), onError }) }}
              onClear={() => { clearDay.mutate(selectedDate, { onSuccess: () => setSelectedDate(null), onError }) }} />
          : <WorkoutLibrary />)}
      </main>

      <DragOverlay dropAnimation={null}><DragGhost workout={dnd.activeGhost} /></DragOverlay>
    </DndContext>
  )
}
