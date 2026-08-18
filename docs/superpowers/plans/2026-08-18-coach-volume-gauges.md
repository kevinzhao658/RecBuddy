# Coach Run/Ride Volume Gauges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the coach's weekly/monthly volume gauges reflect ACTUAL recorded miles (not planned-distance-of-done) and separate run vs ride volume, mirroring the athlete app — with minimal added UI.

**Architecture:** One pure helper (`volumeSplit`) computes run/ride planned+done volumes and time-on-feet from workouts + a bulk actuals map + extras; every gauge surface calls it. One new bulk query (`actuals by workout ids`) feeds the map. A shared `ModeSelect` dropdown (rendered only when ride volume exists) sets ONE `volumeMode` in CoachPage that drives the week toolbar, month toolbar, and month-grid KPI column together.

**Tech Stack:** React 18 + TypeScript strict + TanStack Query + Vitest (coach-web only; athlete iOS already shipped this in `feat/health-sync`).

## UI Visualization (agreed direction: dropdown selection, one shared mode)

**Sport selection is a small DROPDOWN** (`Run ▾` / `Ride ▾`), rendered only when the period has any ride volume — run-only athletes see today's exact UI. One `volumeMode` state lives in CoachPage and drives the week toolbar, the month toolbar, AND the month-grid KPI column together.

```
no rides (unchanged):                    rides exist:
WEEKLY MILEAGE            62%           [Run ▾]  RUN MILEAGE      62%
12.4 / 20.0 mi                                   12.4 / 20.0 mi
[████████░░░░░]                                  [████████░░░░░]
                                        …select Ride →
                                        [Ride ▾]  RIDE MILEAGE    53%
                                                  8.0 / 15.0 mi
                                                  [██████░░░░░░]
```

**Month-grid KPI column follows the selected sport** — selecting Ride in the month toolbar swaps every weekly cell's mileage row (and the column header names the sport so the numbers are never ambiguous):

```
mode = Run                    mode = Ride
WEEKLY VOLUME                 WEEKLY RIDE VOLUME
┌───────────────┐             ┌───────────────┐
│ 12.4/20 mi    │             │ 8.0/15 mi     │
│ [████░░]  62% │             │ [███░░░]  53% │
│ 3h10m/5h  63% │             │ 3h10m/5h  63% │   ← time on feet unchanged
└───────────────┘             └───────────────┘
```

**Time on feet** stays a single combined bar (training time is one budget), but its done side becomes actuals-based (logged elapsed time when present).

## Global Constraints

- Branch: cut `feat/coach-volume` from `dev` **AFTER PR #34 (feat/health-sync) merges** — this work depends on `Actual.source_id`, `useStandaloneActuals`, and `localDayOf` from that PR. Merge commits; never delete branches; commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Kind rule (identical to iOS): an actual with `pace == null` is a RIDE, else a RUN; a done workout with NO actual buckets by its type (`'cross'` → ride, any other non-rest type → run). Extras (workout_id null) bucket by the same pace rule.
- Never render the sport dropdown when the period has no ride volume; `volumeMode` is ONE piece of state in CoachPage's `AthleteDashboard` (resets per athlete via the existing `key={selectedId}` remount) shared by WeekStats, MonthStats, and MonthGrid.
- TS strict; Tailwind tokens only; inline SVG icons (no emoji); a11y names on interactive controls.
- Verify per task: `npm run test:unit && npm run build && npm run lint` from `apps/coach-web/` — all green, 0 lint errors (existing warnings OK). `src/lib/queries/**` tests are LIVE integration tests — never add unit tests there.
- Working commands run from `/Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/coach-web` unless stated.

---

### Task 1: Pure volume helper — `volumeSplit` + `elapsedToMin` (TDD)

**Files:**
- Create: `apps/coach-web/src/lib/volume.ts`
- Test: `apps/coach-web/src/lib/volume.test.ts`

**Interfaces:**
- Consumes: `Workout`, `Actual` from `lib/types`; `estMinutes` from `lib/estMinutes`.
- Produces (every later task relies on these exact names):

```ts
export type VolumeMode = 'run' | 'ride'
export interface VolumeSide { planned: number; done: number }
export interface PeriodVolume {
  run: VolumeSide; ride: VolumeSide; hasRide: boolean
  plannedMin: number; doneMin: number
}
export function elapsedToMin(time: string | null): number | null
export function volumeSplit(workouts: Workout[], actuals: Record<string, Actual>, extras: Actual[]): PeriodVolume
```

- [ ] **Step 1: Create the branch** (only if not already on it)

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git fetch origin && git checkout -b feat/coach-volume origin/dev
```

- [ ] **Step 2: Write the failing tests** — `src/lib/volume.test.ts`:

```ts
import { volumeSplit, elapsedToMin } from './volume'

const w = (id: string, type: string, dist: number | null, status = 'planned') =>
  ({ id, type, dist, status, pace: '9:00/mi', est_minutes: null, dur: null, sets: [] }) as any
const act = (workout_id: string, dist: number, pace: string | null, time: string) =>
  ({ id: 'a' + workout_id, workout_id, dist, pace, time }) as any
const extra = (dist: number, pace: string | null, time: string) =>
  ({ id: 'x' + dist, workout_id: null, dist, pace, time }) as any

test('elapsedToMin parses M:SS and H:MM:SS, rejects garbage', () => {
  expect(elapsedToMin('46:48')).toBe(47)
  expect(elapsedToMin('1:25:14')).toBe(85)
  expect(elapsedToMin('nope')).toBeNull()
  expect(elapsedToMin(null)).toBeNull()
})

test('done run counts its LOGGED distance, not the plan', () => {
  const v = volumeSplit([w('w1', 'easy', 8, 'done')], { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [])
  expect(v.run.done).toBeCloseTo(6.2)
  expect(v.run.planned).toBe(8)
  expect(v.hasRide).toBe(false)
})

test('done workout without a log falls back to planned dist, bucketed by type', () => {
  const v = volumeSplit([w('w1', 'easy', 5, 'done'), w('w2', 'cross', 10, 'done')], {}, [])
  expect(v.run.done).toBe(5)
  expect(v.ride.done).toBe(10)
})

test('ride actual (null pace) on a cross day lands on the ride side', () => {
  const v = volumeSplit([w('w1', 'cross', null, 'done')], { w1: act('w1', 15.3, null, '52:00') }, [])
  expect(v.ride.done).toBeCloseTo(15.3)
  expect(v.run.done).toBe(0)
  expect(v.hasRide).toBe(true)
})

test('extras bucket by the pace rule; rest is excluded from planned', () => {
  const v = volumeSplit([w('w1', 'rest', null)], {}, [extra(5, '9:00/mi', '45:00'), extra(12, null, '40:00')])
  expect(v.run.done).toBe(5)
  expect(v.ride.done).toBe(12)
  expect(v.run.planned).toBe(0)
})

test('time on feet: logged elapsed when present, estMinutes fallback, extras add', () => {
  // w1 done+logged 56:50 (57m), w2 planned 5mi@9:00 (45m est), extra run 45:00.
  const v = volumeSplit([w('w1', 'easy', 8, 'done'), w('w2', 'easy', 5)],
    { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [extra(5, '9:00/mi', '45:00')])
  expect(v.doneMin).toBe(57 + 45)
  expect(v.plannedMin).toBe(72 + 45) // est(8mi@9:00)=72 + est(5mi@9:00)=45
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/volume.test.ts`
Expected: FAIL — cannot resolve `./volume`.

- [ ] **Step 4: Implement `src/lib/volume.ts`:**

```ts
import type { Workout, Actual } from './types'
import { estMinutes } from './estMinutes'

/** Which sport a volume gauge is showing. */
export type VolumeMode = 'run' | 'ride'

export interface VolumeSide { planned: number; done: number }
export interface PeriodVolume {
  run: VolumeSide; ride: VolumeSide; hasRide: boolean
  plannedMin: number; doneMin: number
}

/** '46:48' or '1:25:14' -> whole minutes (rounded); null if unparseable. */
export function elapsedToMin(time: string | null): number | null {
  if (!time) return null
  const p = time.split(':').map(Number)
  if (p.some(isNaN)) return null
  const secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2]
    : p.length === 2 ? p[0] * 60 + p[1] : NaN
  return isNaN(secs) ? null : Math.round(secs / 60)
}

/** Run vs ride volume for a set of workouts, counting LOGGED actuals for done
 *  workouts (kind: pace == null -> ride) with planned-dist fallback bucketed
 *  by type ('cross' -> ride); extras bucket by the same pace rule. Time on
 *  feet stays combined: logged elapsed when present, estMinutes fallback.
 *  Mirrors the athlete app's PlanStore split exactly. */
export function volumeSplit(workouts: Workout[], actuals: Record<string, Actual>, extras: Actual[]): PeriodVolume {
  const run: VolumeSide = { planned: 0, done: 0 }
  const ride: VolumeSide = { planned: 0, done: 0 }
  let plannedMin = 0, doneMin = 0
  for (const w of workouts) {
    if (w.type !== 'rest') (w.type === 'cross' ? ride : run).planned += w.dist ?? 0
    plannedMin += estMinutes(w)
    if (w.status !== 'done') continue
    const a = actuals[w.id]
    if (a) {
      ;(a.pace == null ? ride : run).done += a.dist ?? 0
      doneMin += elapsedToMin(a.time) ?? estMinutes(w)
    } else {
      ;(w.type === 'cross' ? ride : run).done += w.dist ?? 0
      doneMin += estMinutes(w)
    }
  }
  for (const a of extras) {
    ;(a.pace == null ? ride : run).done += a.dist ?? 0
    doneMin += elapsedToMin(a.time) ?? 0
  }
  return { run, ride, hasRide: ride.planned > 0 || ride.done > 0, plannedMin, doneMin }
}
```

- [ ] **Step 5: Run to verify pass** — `npx vitest run src/lib/volume.test.ts`. Expected: 6/6 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/coach-web/src/lib/volume.ts apps/coach-web/src/lib/volume.test.ts
git commit -m "feat(coach): pure run/ride volume split with actuals-first accounting

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Bulk actuals query + realtime invalidation

**Files:**
- Modify: `apps/coach-web/src/lib/queries/actuals.ts` (append)
- Modify: `apps/coach-web/src/lib/useRealtimePlan.ts` (one more invalidation)

**Interfaces:**
- Produces: `useActualsByWorkoutIds(athleteId: string | null, ids: string[])` → `Record<string, Actual>`, query key `['actuals-bulk', athleteId, <sorted ids joined>]`.
- No unit tests here (`lib/queries/**` is live-integration territory); correctness of consumption is covered by Task 1's helper tests and Task 3+ component tests.

- [ ] **Step 1: Append to `src/lib/queries/actuals.ts`:**

```ts
/** All logged actuals for a set of workouts in ONE query — powers the coach's
 *  actuals-based volume gauges. Keyed by workout_id. */
export async function fetchActualsByWorkoutIds(
  client: SupabaseClient, ids: string[],
): Promise<Record<string, Actual>> {
  if (ids.length === 0) return {}
  const { data, error } = await client.from('workout_actuals').select('*').in('workout_id', ids)
  if (error) throw error
  const byId: Record<string, Actual> = {}
  for (const a of (data as Actual[])) if (a.workout_id) byId[a.workout_id] = a
  return byId
}

export function useActualsByWorkoutIds(athleteId: string | null, ids: string[]) {
  return useQuery({
    queryKey: ['actuals-bulk', athleteId, [...ids].sort().join(',')],
    queryFn: () => fetchActualsByWorkoutIds(supabase, ids),
    enabled: !!athleteId && ids.length > 0,
  })
}
```
(`useQuery`, `supabase`, `SupabaseClient`, `Actual` are already imported at the top of this file.)

- [ ] **Step 2: In `src/lib/useRealtimePlan.ts`,** extend the `workout_actuals` handler body (it already invalidates `['actual']` and `['standalone', athleteId]`) with:

```ts
          qc.invalidateQueries({ queryKey: ['actuals-bulk', athleteId] })
```

- [ ] **Step 3: Verify** — `npm run test:unit && npm run build && npm run lint`. Expected: green, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/coach-web/src/lib/queries/actuals.ts apps/coach-web/src/lib/useRealtimePlan.ts
git commit -m "feat(coach): bulk actuals-by-workout query + realtime invalidation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `ModeSelect` dropdown (TDD)

**Files:**
- Create: `apps/coach-web/src/components/ui/ModeSelect.tsx`
- Test: `apps/coach-web/src/components/ui/ModeSelect.test.tsx`

**Interfaces:**
- Consumes: `VolumeMode` from `lib/volume` (Task 1).
- Produces: `ModeSelect({ mode, onChange }: { mode: VolumeMode; onChange: (m: VolumeMode) => void })` — a controlled native `<select>` (accessible name "Volume sport") styled to the tokens, with an inline-SVG chevron.

- [ ] **Step 1: Write the failing test:**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeSelect } from './ModeSelect'

test('renders a sport dropdown and fires onChange with the picked mode', () => {
  const onChange = vi.fn()
  render(<ModeSelect mode="run" onChange={onChange} />)
  const select = screen.getByRole('combobox', { name: /volume sport/i })
  expect(select).toHaveValue('run')
  fireEvent.change(select, { target: { value: 'ride' } })
  expect(onChange).toHaveBeenCalledWith('ride')
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/components/ui/ModeSelect.test.tsx`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ModeSelect.tsx`:**

```tsx
import type { VolumeMode } from '../../lib/volume'

/** Sport dropdown for volume gauges (Run / Ride today; future sports append as
 *  options). Callers render it ONLY when ride volume exists, so run-only
 *  athletes never see extra chrome. Controlled: one volumeMode lives in
 *  CoachPage and drives every gauge surface together. */
export function ModeSelect({ mode, onChange }: {
  mode: VolumeMode; onChange: (m: VolumeMode) => void
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select value={mode} aria-label="Volume sport"
        onChange={(e) => onChange(e.target.value as VolumeMode)}
        className="appearance-none rounded-[9px] border border-line bg-surface2 py-1 pl-2.5 pr-6 text-[11px] font-semibold text-text transition hover:border-text-mute focus:outline-none focus:ring-1 focus:ring-accent">
        <option value="run">Run</option>
        <option value="ride">Ride</option>
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-1.5 h-3 w-3 text-text-faint"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}
```

- [ ] **Step 4: Run to verify pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/components/ui/ModeSelect.tsx apps/coach-web/src/components/ui/ModeSelect.test.tsx
git commit -m "feat(coach): ModeSelect sport dropdown for volume gauges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `WeekStats` — actuals-based, mode-aware (TDD)

**Files:**
- Modify: `apps/coach-web/src/features/plan-grid/WeekStats.tsx` (full rewrite below)
- Test: `apps/coach-web/src/features/plan-grid/WeekStats.test.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `volumeSplit`/`VolumeMode` (Task 1), `ModeSelect` (Task 3), existing `ProgressStat`.
- Produces: `WeekStats({ week, actuals?, extras?, mode?, onModeChange? }: { week: Workout[][]; actuals?: Record<string, Actual>; extras?: Actual[]; mode?: VolumeMode; onModeChange?: (m: VolumeMode) => void })` — new props OPTIONAL so existing call sites keep compiling until Task 6 wires them; the dropdown renders only when `hasRide && onModeChange`.

- [ ] **Step 1: Rewrite the test file** — `WeekStats.test.tsx`:

```tsx
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekStats } from './WeekStats'

const run = (id: string, dist: number, status = 'planned', type = 'easy') =>
  ({ id, type, dist, pace: '9:00/mi', est_minutes: null, dur: null, status, sets: [] }) as any
const act = (workout_id: string, dist: number, pace: string | null, time: string) =>
  ({ id: 'a1', workout_id, dist, pace, time }) as any

test('run-only week: no dropdown, done side uses the LOGGED distance', () => {
  render(<WeekStats week={[[run('w1', 8, 'done')], [], [], [], [], [], []]}
    actuals={{ w1: act('w1', 6.2, '9:10/mi', '56:50') }} mode="run" onModeChange={() => {}} />)
  expect(screen.queryByRole('combobox', { name: /volume sport/i })).toBeNull()
  expect(screen.getByText('Weekly mileage')).toBeInTheDocument()
  expect(screen.getByText('6.2')).toBeInTheDocument()
  expect(screen.getByText(/\/ 8\.0 mi/)).toBeInTheDocument()
})

test('without a log, done falls back to planned (old behavior preserved)', () => {
  render(<WeekStats week={[[run('w1', 3, 'done'), run('w2', 4)], [run('w3', 5)], [], [], [], [], []]} />)
  expect(screen.getByText('3.0')).toBeInTheDocument()
  expect(screen.getByText(/\/ 12\.0 mi/)).toBeInTheDocument()
})

test('ride volume reveals the dropdown; selecting Ride shows ride numbers', () => {
  function Wrap() {
    const [mode, setMode] = useState<'run' | 'ride'>('run')
    const week = [[run('w1', 8), run('c1', 15, 'done', 'cross')], [], [], [], [], [], []]
    return <WeekStats week={week} actuals={{ c1: act('c1', 12.4, null, '48:00') }}
      mode={mode} onModeChange={setMode} />
  }
  render(<Wrap />)
  fireEvent.change(screen.getByRole('combobox', { name: /volume sport/i }), { target: { value: 'ride' } })
  expect(screen.getByText('Ride mileage')).toBeInTheDocument()
  expect(screen.getByText('12.4')).toBeInTheDocument()
  expect(screen.getByText(/\/ 15\.0 mi/)).toBeInTheDocument()
})

test('time on feet uses logged elapsed when present', () => {
  render(<WeekStats week={[[run('w1', 6, 'done')], [run('w2', 6)], [], [], [], [], []]}
    actuals={{ w1: act('w1', 6, '9:00/mi', '50:00') }} />)
  expect(screen.getByText('50m')).toBeInTheDocument()   // logged, not est 54m
  expect(screen.getByText(/\/ 1h 48m/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/plan-grid/WeekStats.test.tsx`. Expected: FAIL (props/chip don't exist yet).

- [ ] **Step 3: Rewrite `WeekStats.tsx`:**

```tsx
import type { Workout, Actual } from '../../lib/types'
import { volumeSplit, type VolumeMode } from '../../lib/volume'
import { fmtDur } from '../../lib/fmtDur'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { ProgressStat } from '../../components/ui/ProgressStat'
import { ModeSelect } from '../../components/ui/ModeSelect'

/** Weekly completion against plan, actuals-first. Mileage separates run vs
 *  ride via the shared sport dropdown (rendered only when the week has ride
 *  volume); time on feet stays one combined bar. Mode is CONTROLLED — one
 *  volumeMode in CoachPage drives every gauge surface together. */
export function WeekStats({ week, actuals = {}, extras = [], mode = 'run', onModeChange }: {
  week: Workout[][]; actuals?: Record<string, Actual>; extras?: Actual[]
  mode?: VolumeMode; onModeChange?: (m: VolumeMode) => void
}) {
  const { unit } = useUnit()
  const vol = volumeSplit(week.flat(), actuals, extras)
  const side = mode === 'ride' && vol.hasRide ? vol.ride : vol.run
  const label = vol.hasRide ? (mode === 'ride' ? 'Ride mileage' : 'Run mileage') : 'Weekly mileage'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {vol.hasRide && onModeChange && <ModeSelect mode={mode} onChange={onModeChange} />}
      <ProgressStat label={label} done={side.done} planned={side.planned}
        doneText={fromMiles(side.done, unit).toFixed(1)}
        plannedText={`${fromMiles(side.planned, unit).toFixed(1)} ${unit}`}
        tint="bg-accent" />
      <ProgressStat label="Time on feet" done={vol.doneMin} planned={vol.plannedMin}
        doneText={fmtDur(vol.doneMin)} plannedText={fmtDur(vol.plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**, then the full suite: `npm run test:unit`. Expected: all green (the two preserved old-behavior cases prove no regression at unwired call sites).

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/features/plan-grid/WeekStats.tsx apps/coach-web/src/features/plan-grid/WeekStats.test.tsx
git commit -m "feat(coach): WeekStats — actuals-based run/ride mileage with sport dropdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `MonthStats` — same treatment

**Files:**
- Modify: `apps/coach-web/src/features/plan-grid/MonthStats.tsx` (full rewrite below)
- Test: `apps/coach-web/src/features/plan-grid/MonthStats.test.tsx` (create)

**Interfaces:**
- Produces: `MonthStats({ byDate, anchor, actuals?, extras?, mode?, onModeChange? })` — `extras` is the month's standalone actuals, PRE-FILTERED to the anchor month by the caller (Task 6); `mode`/`onModeChange` are the same controlled pair as WeekStats.

- [ ] **Step 1: Write the failing test** — `MonthStats.test.tsx`:

```tsx
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthStats } from './MonthStats'

const w = (id: string, date: string, dist: number, status = 'planned', type = 'easy') =>
  ({ id, date, type, dist, pace: '9:00/mi', est_minutes: null, dur: null, status, sets: [] }) as any

test('monthly mileage counts logged actuals and the dropdown swaps to ride volume', () => {
  const byDate = {
    '2026-08-03': [w('w1', '2026-08-03', 8, 'done')],
    '2026-08-04': [w('c1', '2026-08-04', 20, 'done', 'cross')],
  }
  const actuals = {
    w1: { id: 'a1', workout_id: 'w1', dist: 6.2, pace: '9:10/mi', time: '56:50' } as any,
    c1: { id: 'a2', workout_id: 'c1', dist: 18.5, pace: null, time: '1:02:00' } as any,
  }
  function Wrap() {
    const [mode, setMode] = useState<'run' | 'ride'>('run')
    return <MonthStats byDate={byDate} anchor="2026-08-01" actuals={actuals}
      mode={mode} onModeChange={setMode} />
  }
  render(<Wrap />)
  expect(screen.getByText('6.2')).toBeInTheDocument()          // run side, actuals-based
  fireEvent.change(screen.getByRole('combobox', { name: /volume sport/i }), { target: { value: 'ride' } })
  expect(screen.getByText('Ride mileage')).toBeInTheDocument()
  expect(screen.getByText('18.5')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure.** Expected: FAIL.

- [ ] **Step 3: Rewrite `MonthStats.tsx`:**

```tsx
import type { Workout, Actual } from '../../lib/types'
import { monthOf } from '../../lib/week'
import { volumeSplit, type VolumeMode } from '../../lib/volume'
import { fmtDur } from '../../lib/fmtDur'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { ProgressStat } from '../../components/ui/ProgressStat'
import { ModeSelect } from '../../components/ui/ModeSelect'

/** Month completion against plan (in-month days only), actuals-first, run/ride
 *  split — the weekly KPIs summed over the month. `extras` arrives pre-filtered
 *  to the anchor month by the caller. Mode is CONTROLLED and shared with the
 *  month grid, so selecting Ride here swaps the KPI column too. */
export function MonthStats({ byDate, anchor, actuals = {}, extras = [], mode = 'run', onModeChange }: {
  byDate: Record<string, Workout[]>; anchor: string
  actuals?: Record<string, Actual>; extras?: Actual[]
  mode?: VolumeMode; onModeChange?: (m: VolumeMode) => void
}) {
  const { unit } = useUnit()
  const m = monthOf(anchor)
  const ws = Object.values(byDate).flat().filter((w) => monthOf(w.date) === m)
  const vol = volumeSplit(ws, actuals, extras)
  const side = mode === 'ride' && vol.hasRide ? vol.ride : vol.run
  const label = vol.hasRide ? (mode === 'ride' ? 'Ride mileage' : 'Run mileage') : 'Monthly mileage'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {vol.hasRide && onModeChange && <ModeSelect mode={mode} onChange={onModeChange} />}
      <ProgressStat label={label} done={side.done} planned={side.planned}
        doneText={fromMiles(side.done, unit).toFixed(1)}
        plannedText={`${fromMiles(side.planned, unit).toFixed(1)} ${unit}`}
        tint="bg-accent" />
      <ProgressStat label="Time on feet" done={vol.doneMin} planned={vol.plannedMin}
        doneText={fmtDur(vol.doneMin)} plannedText={fmtDur(vol.plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** + full `npm run test:unit`. Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/features/plan-grid/MonthStats.tsx apps/coach-web/src/features/plan-grid/MonthStats.test.tsx
git commit -m "feat(coach): MonthStats — actuals-based run/ride volume

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Month-grid KPI column + CoachPage wiring

**Files:**
- Modify: `apps/coach-web/src/features/plan-grid/MonthGrid.tsx` (WeekSummary + props + header)
- Modify: `apps/coach-web/src/routes/CoachPage.tsx` (volumeMode state + wire hooks + props)

**Interfaces:**
- Consumes: `useActualsByWorkoutIds` (Task 2), `volumeSplit`/`VolumeMode` (Task 1), `weekDates`/`monthOf` from `lib/week`.
- Produces: `MonthGrid` gains optional `actuals?: Record<string, Actual>`, `extrasByDate?: Record<string, Actual[]>`, and `mode?: VolumeMode` — **the KPI column shows the SELECTED sport's volume**, so picking Ride in the month toolbar swaps every weekly cell.

- [ ] **Step 1: MonthGrid.** Add to the type imports: `Actual`; add `import { volumeSplit, type VolumeMode } from '../../lib/volume'`. Change `WeekSummary` to (mode-driven mileage row; time row unchanged):

```tsx
function WeekSummary({ days, extras, actuals, mode, isCurrent }: {
  days: Workout[][]; extras: Actual[]; actuals: Record<string, Actual>
  mode: VolumeMode; isCurrent: boolean
}) {
  const { unit } = useUnit()
  const vol = volumeSplit(days.flat(), actuals, extras)
  const side = mode === 'ride' ? vol.ride : vol.run
  const milePct = side.planned > 0 ? Math.round((side.done / side.planned) * 100) : 0
  const timePct = vol.plannedMin > 0 ? Math.round((vol.doneMin / vol.plannedMin) * 100) : 0
  return (
    <div className="p-1.5">
      <div className={`rb-card-sm flex h-full flex-col justify-center gap-2 p-2.5 ${isCurrent ? 'ring-1 ring-text/30' : ''}`}>
        <KpiBar tint="bg-accent" pct={milePct}
          value={<><span className="font-bold text-text">{fmtDist(side.done, unit)}</span><span className="text-text-faint">/{fmtDist(side.planned, unit)} {unit}</span></>} />
        <KpiBar tint="bg-text-mute" pct={timePct}
          value={<><span className="font-bold text-text">{fmtDur(vol.doneMin)}</span><span className="text-text-faint">/{fmtDur(vol.plannedMin)}</span></>} />
      </div>
    </div>
  )
}
```

`MonthGrid`'s signature gains the optional props and threads them:

```tsx
export function MonthGrid({ anchor, byDate, selectedDate, canEdit = true, actuals = {}, extrasByDate = {}, mode = 'run', onPick }: {
  anchor: string; byDate: Record<string, Workout[]>; selectedDate: string | null; canEdit?: boolean
  actuals?: Record<string, Actual>; extrasByDate?: Record<string, Actual[]>; mode?: VolumeMode
  onPick: (date: string) => void
}) {
```

The KPI column HEADER names the sport so a swapped column is never ambiguous — change the header cell text to:

```tsx
        <div className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">{mode === 'ride' ? 'Weekly ride volume' : 'Weekly volume'}</div>
```

and the `WeekSummary` call becomes:

```tsx
            <WeekSummary days={week.map((d) => byDate[d] ?? [])}
              extras={week.flatMap((d) => extrasByDate[d] ?? [])}
              actuals={actuals} mode={mode} isCurrent={week.includes(todayIso)} />
```

- [ ] **Step 2: CoachPage (`AthleteDashboard`).** Add imports: `useActualsByWorkoutIds` (from `../lib/queries/actuals`), `type VolumeMode` (from `../lib/volume`), and add `weekDates` + `monthOf` to the `../lib/week` import. Below the `extrasByDate` block, add:

```tsx
  // ONE sport selection drives every volume gauge (week toolbar, month
  // toolbar, month-grid KPI column). Resets per athlete via key={selectedId}.
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('run')
  // Bulk actuals power the actuals-based volume gauges (week + month).
  const weekIds = week.flat().map((w) => w.id)
  const monthIds = Object.values(monthQ.data ?? {}).flat().map((w) => w.id)
  const weekActualsQ = useActualsByWorkoutIds(athleteId, weekIds)
  const monthActualsQ = useActualsByWorkoutIds(athleteId, monthIds)
  const weekExtras = weekDates(monday).flatMap((d) => extrasByDate[d] ?? [])
  const monthExtras = Object.entries(extrasByDate)
    .filter(([d]) => monthOf(d) === monthOf(monthAnchor))
    .flatMap(([, list]) => list)
```

Update the three call sites:
- `<WeekStats week={week} actuals={weekActualsQ.data ?? {}} extras={weekExtras} mode={volumeMode} onModeChange={setVolumeMode} />`
- `<MonthStats byDate={monthQ.data ?? {}} anchor={monthAnchor} actuals={monthActualsQ.data ?? {}} extras={monthExtras} mode={volumeMode} onModeChange={setVolumeMode} />`
- `<MonthGrid ... actuals={monthActualsQ.data ?? {}} extrasByDate={extrasByDate} mode={volumeMode} ... />` (keep all existing props)

- [ ] **Step 4: Verify** — `npm run test:unit && npm run build && npm run lint`. Expected: all green, 0 lint errors (MonthGrid's existing tests pass unchanged: with no `actuals` prop the fallback path reproduces today's numbers).

- [ ] **Step 4: Commit**

```bash
git add apps/coach-web/src/features/plan-grid/MonthGrid.tsx apps/coach-web/src/routes/CoachPage.tsx
git commit -m "feat(coach): mode-driven month KPI column + actuals wiring for all gauges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Final verification + PR

- [ ] **Step 1:** `npm run test:unit && npm run build && npm run lint` — all green, 0 errors.
- [ ] **Step 2:** Push + PR into dev (merge commit, never delete the branch):

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git push -u origin feat/coach-volume
gh pr create --base dev --head feat/coach-volume \
  --title "Coach volume gauges: actuals-based run/ride split" \
  --body "Coach-web counterpart of the athlete gauge corrections: weekly/monthly mileage now counts LOGGED actual distance (planned as fallback for log-less completes), run and ride volumes never pool (a Run/Ride dropdown appears only when ride volume exists; one selection drives week toolbar, month toolbar, and the month KPI column), the month-grid KPI column follows the selected sport (header names it), and time on feet uses logged elapsed time. One bulk actuals query + one pure, fully-tested volumeSplit helper shared by every gauge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Deferred / out of scope

- Ride-specific tint or avg-speed display (the dropdown + headers name the mode; keep one accent).
- Splitting time-on-feet by mode (training time stays one budget).
- Live-integration test for the bulk query (manual `lib/queries` suite convention).
