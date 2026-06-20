import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { RosterSidebar } from '../features/roster/RosterSidebar'
import { TopBar } from '../features/plan-grid/TopBar'
import { WeekGrid } from '../features/plan-grid/WeekGrid'
import { WorkoutEditor } from '../features/editor/WorkoutEditor'
import { WorkoutLibrary } from '../features/library/WorkoutLibrary'
import { TeamPopover } from '../features/team/TeamPopover'
import { Toast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { useRoster } from '../lib/queries/roster'
import { useTeam } from '../lib/queries/team'
import { useLibrary } from '../lib/queries/library'
import { useAthletePlan, useUpsertWorkout, useClearDay, useMoveWorkout, usePasteWorkout, useDuplicateWeek } from '../lib/queries/plan'
import { useClipboard } from '../features/plan-grid/useClipboard'
import { useRealtimePlan } from '../lib/useRealtimePlan'
import { mondayOf, addDays } from '../lib/week'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Workout } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)

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
      <main className="flex-1">
        <div className="rb-surface flex items-center justify-between gap-3 border-b border-line px-6 py-2.5">
          <Wordmark className="text-2xl" />
          <div className="flex items-center gap-4">
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-text-mute hover:text-text">Log out</button>
            <span title="Available when the athlete app ships" className="text-sm text-text-faint">Preview as athlete</span>
          </div>
        </div>
        {selectedId
          ? <AthleteDashboard
              key={selectedId} athleteId={selectedId} coachId={session!.user.id}
              monday={monday} setMonday={setMonday}
              selectedDate={selectedDate} setSelectedDate={setSelectedDate}
              clipboard={clipboard} sensors={sensors} flash={flash} />
          : <div className="grid place-items-center px-6 py-24 text-center">
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">Roster</p>
              <p className="mt-3 text-text-mute">Select an athlete</p>
              <p className="mt-1 text-sm text-text-faint">Pick someone from the roster to build their week.</p>
            </div>}
      </main>
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

  if (!entry) return <p className="p-6 text-text-mute">Loading…</p>

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col">
        <div className="flex items-center gap-4 px-6 pt-3">
          <div className="flex-1"><TopBar athlete={entry.athlete} plan={entry.plans?.[0] ?? null} week={week} /></div>
        </div>
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))} className="text-2xl leading-none text-text-mute hover:text-text">‹</button>
            <span className="font-num text-sm tabular-nums text-text-mute">{monday} – {addDays(monday, 6)}</span>
            <button aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))} className="text-2xl leading-none text-text-mute hover:text-text">›</button>
          </div>
          <div className="flex items-center gap-3">
            <TeamPopover athleteId={athleteId} isHead={isHead} />
            <Button variant="ghost" disabled title="Chat ships in a later release">Message</Button>
            <Button onClick={() => duplicate.mutate(undefined, { onSuccess: () => flash('Week duplicated to next week'), onError: (err: any) => flash(err.message) })}>Duplicate week</Button>
          </div>
        </div>
        <div className="flex flex-1">
          <div className="flex-1 p-6">
            <WeekGrid monday={monday} week={week} selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d)}
              onCopy={(w) => { clipboard.copy(w); flash('Workout copied') }}
              canPaste={!!clipboard.clip}
              onPaste={(d) => clipboard.clip && paste.mutate({ date: d, source: clipboard.clip }, { onError: (err: any) => flash(err.message) })} />
          </div>
          {selectedDate
            ? <WorkoutEditor key={selectedDate} date={selectedDate} workout={selectedWorkout}
                onSave={(draft) => { upsert.mutate({ date: selectedDate, draft }, { onSuccess: () => setSelectedDate(null), onError: (err: any) => flash(err.message) }) }}
                onClear={() => { clearDay.mutate(selectedDate, { onSuccess: () => setSelectedDate(null), onError: (err: any) => flash(err.message) }) }} />
            : <WorkoutLibrary />}
        </div>
      </div>
    </DndContext>
  )
}
