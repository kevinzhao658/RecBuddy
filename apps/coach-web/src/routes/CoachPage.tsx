import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { RosterSidebar } from '../features/roster/RosterSidebar'
import { AthleteSettingsModal } from '../features/roster/AthleteSettingsModal'
import { TopBar } from '../features/plan-grid/TopBar'
import { PlanToolbar, type PlanView } from '../features/plan-grid/PlanToolbar'
import { WeekStats } from '../features/plan-grid/WeekStats'
import { MonthStats } from '../features/plan-grid/MonthStats'
import { WeekGrid } from '../features/plan-grid/WeekGrid'
import { MonthGrid } from '../features/plan-grid/MonthGrid'
import { MonthDayModal } from '../features/plan-grid/MonthDayModal'
import { WorkoutKey } from '../features/plan-grid/WorkoutKey'
import { DragGhost } from '../features/plan-grid/DragGhost'
import { useAthleteDnd } from '../features/plan-grid/useAthleteDnd'
import { WorkoutEditor } from '../features/editor/WorkoutEditor'
import { WorkoutResults } from '../features/editor/WorkoutResults'
import { WorkoutLibrary } from '../features/library/WorkoutLibrary'
import { ChatPanel } from '../features/chat/ChatPanel'
import { TeamPopover } from '../features/team/TeamPopover'
import { Toast } from '../components/ui/Toast'
import { useRoster } from '../lib/queries/roster'
import { useLibrary } from '../lib/queries/library'
import { useAthletePlan, useAthleteMonth, useUpsertWorkout, useDeleteWorkout, useMoveWorkout, usePasteWorkout, useDuplicateWeek } from '../lib/queries/plan'
import type { Workout } from '../lib/types'
import { useShareWorkout, useShareAdjust, useUnreadCounts, useUnreadRealtime } from '../lib/queries/chat'
import { UnreadBadge } from '../components/ui/UnreadBadge'
import { useClipboard } from '../features/plan-grid/useClipboard'
import { useRealtimePlan } from '../lib/useRealtimePlan'
import { mondayOf, addDays, fmtShortDate, firstOfMonth, addMonths, fmtMonthYear, todayISO } from '../lib/week'

/** Short one-line summary of a workout for chat adjust cards (from → to). */
const wSummary = (w: { title: string; dist: number | null; pace: string | null }) =>
  w.dist != null ? `${w.title} · ${w.dist} mi @ ${w.pace}` : w.title

// Stable empty week (7 empty day slots) while the query loads. Built with
// Array.from so the slots don't share one array reference.
const EMPTY_WEEK: Workout[][] = Array.from({ length: 7 }, () => [])

function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function CoachPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [monday, setMonday] = useState<string>(() => mondayOf(todayISO()))
  const [monthAnchor, setMonthAnchor] = useState<string>(() => firstOfMonth(todayISO()))
  const [view, setView] = useState<PlanView>('week')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // Selected workout on that date; null + selectedDate = composing a NEW workout.
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const clipboard = useClipboard()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  useUnreadRealtime() // keep unread badges live across the whole coach view

  // Close mobile roster drawer whenever an athlete is selected
  useEffect(() => { setRosterOpen(false) }, [selectedId])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200) }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar: hidden on phones, shown md+ as a static column */}
      <div className="hidden md:flex">
        <RosterSidebar selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedDate(null); setSelectedWorkoutId(null) }} />
      </div>

      {/* Mobile roster drawer (phones only) */}
      {rosterOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRosterOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40">
            <RosterSidebar selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedDate(null); setSelectedWorkoutId(null) }} />
          </div>
        </div>
      )}

      {selectedId
        ? <AthleteDashboard
            key={selectedId} athleteId={selectedId}
            monday={monday} setMonday={setMonday} monthAnchor={monthAnchor} setMonthAnchor={setMonthAnchor}
            view={view} setView={setView}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            selectedWorkoutId={selectedWorkoutId} setSelectedWorkoutId={setSelectedWorkoutId}
            clipboard={clipboard} sensors={sensors} flash={flash}
            onMenu={() => setRosterOpen(true)}
            onAthleteRemoved={() => { setSelectedId(null); flash('Athlete removed from roster') }} />
        : <main className="relative grid flex-1 place-items-center px-6 py-32 text-center">
            {/* Hamburger visible only on phones (no TopBar in empty state) */}
            <button aria-label="Open roster" onClick={() => setRosterOpen(true)}
              className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface2 text-text-mute hover:text-text md:hidden">
              <HamburgerIcon />
            </button>
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

function AthleteDashboard({ athleteId, monday, setMonday, monthAnchor, setMonthAnchor, view, setView, selectedDate, setSelectedDate, selectedWorkoutId, setSelectedWorkoutId, clipboard, sensors, flash, onMenu, onAthleteRemoved }: {
  athleteId: string
  monday: string; setMonday: (m: string) => void
  monthAnchor: string; setMonthAnchor: (m: string) => void
  view: PlanView; setView: (v: PlanView) => void
  selectedDate: string | null; setSelectedDate: (d: string | null) => void
  selectedWorkoutId: string | null; setSelectedWorkoutId: (id: string | null) => void
  clipboard: ReturnType<typeof useClipboard>; sensors: ReturnType<typeof useSensors>; flash: (m: string) => void
  onMenu: () => void
  onAthleteRemoved: () => void
}) {
  useRealtimePlan(athleteId)
  const roster = useRoster()
  const library = useLibrary()
  const planQ = useAthletePlan(athleteId, monday)
  const monthQ = useAthleteMonth(athleteId, monthAnchor, view === 'month')
  const upsert = useUpsertWorkout(athleteId, monday)
  const del = useDeleteWorkout(athleteId, monday)
  const move = useMoveWorkout(athleteId, monday)
  const paste = usePasteWorkout(athleteId, monday)
  const duplicate = useDuplicateWeek(athleteId, monday)
  const shareWorkout = useShareWorkout(athleteId)
  const shareAdjust = useShareAdjust(athleteId)
  const unread = useUnreadCounts()

  const entry = (roster.data ?? []).find((r) => r.athlete.id === athleteId)
  const week = planQ.data ?? EMPTY_WEEK
  // The signed-in coach's access to THIS athlete gates every editing affordance.
  // RLS is the real backstop; this just hides/disables what they can't use.
  const perm = entry?.permission ?? 'read'
  const canEdit = perm !== 'read'
  const isAdmin = perm === 'admin'
  const selectedWorkout = week.flat().find((w) => w.id === selectedWorkoutId) ?? null
  const clearSelection = () => { setSelectedDate(null); setSelectedWorkoutId(null) }

  const onError = (err: any) => flash(err.message)
  const dnd = useAthleteDnd({
    week, library: library.data,
    onPasteTemplate: (date, tpl) => paste.mutate({ date, source: tpl }, { onError }),
    onMove: (id, to) => move.mutate({ id, to }, { onError }),
  })

  const [chatOpen, setChatOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Month day with 2+ workouts opens this read-only picker instead of jumping.
  const [monthModalDate, setMonthModalDate] = useState<string | null>(null)

  // Close library overlay when a day is selected (editor takes over)
  useEffect(() => { if (selectedDate) setLibraryOpen(false) }, [selectedDate])

  const goMonth = () => { setMonthAnchor(firstOfMonth(monday)); setView('month') }
  const prev = () => view === 'week' ? setMonday(addDays(monday, -7)) : setMonthAnchor(addMonths(monthAnchor, -1))
  const next = () => view === 'week' ? setMonday(addDays(monday, 7)) : setMonthAnchor(addMonths(monthAnchor, 1))
  // From the month overview: a day with 2+ workouts opens a read-only picker so
  // the coach chooses which to edit; 0 or 1 opens it (or a blank editor) in the
  // right-hand panel right there — the month view never routes to the week.
  const pickMonthDay = (date: string) => {
    const ws = monthQ.data?.[date] ?? []
    if (ws.length >= 2) { setMonthModalDate(date); return }
    setMonday(mondayOf(date)); setSelectedDate(date)
    setSelectedWorkoutId(ws[0]?.id ?? null)
  }
  // Picking a workout in that modal opens it in the editor panel, in place.
  const openMonthWorkout = (workoutId: string) => {
    if (!monthModalDate) return
    setMonday(mondayOf(monthModalDate)); setSelectedDate(monthModalDate)
    setSelectedWorkoutId(workoutId); setMonthModalDate(null)
  }

  if (!entry) return <main className="flex-1 p-6 text-text-mute">Loading…</main>

  // Editor/results panel — renders in BOTH week and month view so a month-view
  // pick edits in place instead of routing to the week. While an existing
  // workout's week is still loading, hold a placeholder so the editor never
  // mounts against stale/blank data (its state seeds once, from the workout).
  // Key includes the workout id ('new' while composing) so switching workouts remounts.
  const editorReady = selectedWorkoutId == null || selectedWorkout != null
  const editorPanel = !selectedDate
    ? null
    : !editorReady
    ? (planQ.isFetching
        ? <aside className="rb-surface flex h-full w-80 shrink-0 items-center justify-center border-l border-line text-sm text-text-mute">Loading…</aside>
        : null)
    : selectedWorkout?.status === 'done'
      ? <WorkoutResults key={selectedWorkoutId ?? selectedDate} workout={selectedWorkout} onClose={clearSelection} />
      : <WorkoutEditor key={`${selectedDate}:${selectedWorkoutId ?? 'new'}`} date={selectedDate} workout={selectedWorkout}
          canDelete={!!selectedWorkoutId} readOnly={!canEdit}
          onSave={(draft) => { upsert.mutate({ date: selectedDate, draft, id: selectedWorkoutId }, { onSuccess: clearSelection, onError }) }}
          onClear={() => {
            if (selectedWorkoutId) del.mutate(selectedWorkoutId, { onSuccess: clearSelection, onError })
            else clearSelection()
          }}
          onShare={selectedWorkout ? (changed, draft) => {
            if (changed) shareAdjust.mutate({ from: wSummary(selectedWorkout), to: wSummary(draft) }, { onSuccess: () => flash('Change shared to chat'), onError })
            else shareWorkout.mutate(selectedWorkout, { onSuccess: () => flash('Shared to chat'), onError })
          } : undefined} />

  // Desktop right rail: editor when day selected, otherwise library
  const desktopRail = editorPanel ?? <WorkoutLibrary />

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd}>
      <main className="flex min-h-screen min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            athlete={entry.athlete}
            plan={entry.plans?.[0] ?? null}
            monday={monday}
            onMenu={onMenu}
            onSettings={() => setSettingsOpen(true)}
            actions={
              <>
                <TeamPopover athleteId={athleteId} isAdmin={isAdmin} />
                <button onClick={() => setChatOpen(true)}
                  className="flex items-center gap-1.5 rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-110">
                  <ChatIcon className="h-4 w-4" /> Message
                  <UnreadBadge count={unread.data?.[athleteId] ?? 0} className="ml-0.5" />
                </button>
                {canEdit && (
                  <button onClick={() => duplicate.mutate(undefined, { onSuccess: () => flash('Week duplicated to next week'), onError })}
                    className="hidden items-center gap-1.5 rounded-[12px] border border-line bg-surface2 px-4 py-2 text-sm font-semibold text-text hover:border-text-mute sm:flex">
                    <span className="text-accent">＋</span> Duplicate week
                  </button>
                )}
              </>
            }
          />

          <PlanToolbar
            view={view} onWeek={() => setView('week')} onMonth={goMonth} onPrev={prev} onNext={next}
            label={view === 'week' ? `${fmtShortDate(monday)} – ${fmtShortDate(addDays(monday, 6))}` : fmtMonthYear(monthAnchor)}
            isCurrent={view === 'week' ? monday === mondayOf(todayISO()) : monthAnchor === firstOfMonth(todayISO())}
            stats={view === 'week' ? <WeekStats week={week} /> : <MonthStats byDate={monthQ.data ?? {}} anchor={monthAnchor} />}
            onLibrary={() => setLibraryOpen(true)} />

          {view === 'week' ? (
            // Clicking blank space exits the editor (workout cards stop propagation)
            <div className="flex-1 px-6 pb-6 pt-5" onClick={() => selectedDate && clearSelection()}>
              <WeekGrid monday={monday} week={week} selectedId={selectedWorkoutId} canEdit={canEdit}
                onSelectWorkout={(date, id) => { setSelectedDate(date); setSelectedWorkoutId(id) }}
                onCopy={(w) => { clipboard.copy(w); flash('Workout copied') }}
                canPaste={!!clipboard.clip}
                onPaste={(d) => clipboard.clip && paste.mutate({ date: d, source: clipboard.clip }, { onError })} />
              <WorkoutKey />
              <p className="mt-4 px-1 text-xs text-text-faint">{canEdit ? 'Drag from the workout library or move cards between days · Click any day to edit' : 'You have view-only access · Click any day to see the workout'}</p>
            </div>
          ) : (
            // Clicking blank space closes the editor (day cells stop propagation),
            // which brings the workout library back into the rail to drag from.
            <div className="flex-1 px-6 pb-6 pt-5" onClick={() => selectedDate && clearSelection()}>
              <MonthGrid anchor={monthAnchor} byDate={monthQ.data ?? {}} selectedDate={selectedDate} canEdit={canEdit} onPick={pickMonthDay} />
              <p className="mt-4 px-1 text-xs text-text-faint">{canEdit ? 'Click a day to edit it here · drag a workout from the library onto a day to add it' : 'Click a day to see its workouts'}</p>
            </div>
          )}
        </div>

        {/* ≥lg: static right rail (editor when day selected, otherwise library) */}
        <div className="hidden lg:flex">
          {desktopRail}
        </div>

        {/* <lg: editor/results overlay when a day is selected */}
        {editorPanel && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={clearSelection} />
            <div className="fixed inset-y-0 right-0 z-40 shadow-2xl">
              {editorPanel}
            </div>
          </div>
        )}

        {/* <lg: library overlay (only when no editor is showing) */}
        {libraryOpen && !editorPanel && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setLibraryOpen(false)} />
            <div className="fixed inset-y-0 right-0 z-40 shadow-2xl">
              <WorkoutLibrary />
            </div>
          </div>
        )}
      </main>

      <DragOverlay dropAnimation={null}><DragGhost workout={dnd.activeGhost} /></DragOverlay>

      {chatOpen && <ChatPanel athleteId={athleteId} athleteName={entry.athlete.name} athleteAvatarUrl={entry.athlete.avatar_url} onClose={() => setChatOpen(false)}
        onOpenDay={(date, workoutId) => {
          // No id on the card -> fall back to the day's first workout if that
          // week is already loaded, else open the day fresh.
          const fallback = week.flat().find((w) => w.date === date)?.id ?? null
          setMonday(mondayOf(date)); setView('week'); setSelectedDate(date)
          setSelectedWorkoutId(workoutId ?? fallback); setChatOpen(false)
        }} />}

      {settingsOpen && <AthleteSettingsModal open onClose={() => setSettingsOpen(false)}
        athlete={entry.athlete} plan={entry.plans?.[0] ?? null} canEdit={canEdit} isAdmin={isAdmin}
        onSaved={() => flash('Goal updated')} onRemoved={onAthleteRemoved} />}

      {monthModalDate && <MonthDayModal open date={monthModalDate}
        workouts={monthQ.data?.[monthModalDate] ?? []}
        onPick={openMonthWorkout} onClose={() => setMonthModalDate(null)} />}
    </DndContext>
  )
}
