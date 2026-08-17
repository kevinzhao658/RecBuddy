# Apple Health Live Sync — Design

**Date:** 2026-08-17
**Status:** Approved design, pending implementation plan
**Owner surface:** athlete-iOS (primary), supabase (one migration), coach-web (standalone-run rendering)

## Purpose

Extract workout completion data from Apple Health automatically so athletes stop
manually logging runs. When a run (or ride) is recorded on the athlete's
watch/phone, RecBuddy logs it against the training plan — silently when the
match is unambiguous, with a one-tap confirmation when it isn't — and the coach
sees the result live, including off-plan extra runs and rides.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Automation level | **Hybrid** — auto-log the unambiguous 1:1 match; confirm card otherwise |
| Sync trigger | **Background delivery in v1** (HKObserverQuery + enableBackgroundDelivery), plus foreground sync on app open / pull-to-refresh |
| Existing actual conflict | **Never overwrite** — a workout that already has an actual is skipped |
| Unmatched activities | **Confirm, then standalone** — athlete confirms; with no planned match the activity is stored as its own extra-run/ride card |
| Coach visibility | **Coach sees extra runs/rides** as cards on the day, live |
| Activity scope (v1) | **Running + cycling.** Runs match running workout types; rides match `cross`. Everything else skipped |
| Matching location | **Client-side (iOS)** — pure `HealthMatcher`; backend delta kept to one migration |
| Prerequisite | Paid Apple Developer Program (HealthKit entitlement; background delivery). User is enrolling |

## Architecture

New iOS layer `apps/athlete-ios/RecBuddy/Health/`, three units with one job each:

### HealthKitGateway
The only component that touches `HKHealthStore`. Behind a protocol
(`HealthGateway`) so tests inject a fake.
- `requestAuthorization()` — read access: workouts, distance (running+cycling), heart rate.
- `fetchWorkouts(since: Date) -> [HealthRun]` — `HKWorkout` samples mapped to a
  plain value: `uuid`, `startDate`, `distanceMeters`, `durationSeconds`,
  `avgHR?`, `activity` (`.running` / `.cycling` / `.other`).
- `startObserving(handler:)` — registers `HKObserverQuery` +
  `enableBackgroundDelivery` so a newly recorded workout wakes the app. The
  handler **always** calls HealthKit's completion handler, success or failure.

### HealthMatcher
A **pure function** — no HealthKit, no network, no store. The correctness core
and primary unit-test surface.

```
classify(run: HealthRun,
         dayWorkouts: [Workout],        // that local calendar day
         loggedWorkoutIds: Set<String>, // already have an actual
         seenSourceIds: Set<String>)    // already-synced HK UUIDs
  -> MatchOutcome
```

`MatchOutcome`: `.autoLog(workoutId)` | `.needsConfirm(candidateWorkoutIds)` |
`.standalone` | `.skip(reason)`.

### HealthSyncCoordinator
Orchestrates a sync pass; owns `lastSync` and the pending-confirmation queue.
- Pull runs since `lastSync` (minus an overlap window; `source_id` dedup absorbs it).
- Classify each via `HealthMatcher`; route: auto → `PlanStore.logRun(...)`;
  standalone/ambiguous → pending confirmation (+ local notification when in
  background).
- Persist `lastSync` (UserDefaults) and pending confirmations (survive relaunch).

### Reused: PlanStore
- `logRun` gains `source`/`sourceId` parameters (default `manual`/nil — existing
  callers unchanged). Existing DB-checked dedup + `mark_workout_status` reused.
- New `logStandaloneRun(...)` — inserts an actual with `workout_id = null`,
  `recorded_at` = the run's start time.
- New cache `standaloneByDate: [String: [WorkoutActual]]`;
  `refresh()`/`loadMonth()` also fetch `workout_id is null` rows for the loaded
  range. (Existing `actualsByWorkout` is keyed by workout id and cannot hold
  standalone rows.)

## Matching rules

Matching is per **local calendar day**, judged **within each activity family
independently** (a run and a ride on the same day never make each other
ambiguous).

- **Families:** running Health workouts ↔ running workout types
  (`easy, long, speed, tempo, recovery, race`); cycling Health workouts ↔
  `cross`. `rest`/`other` are never candidates.
- **Candidates** = that day's workouts of the family's types **without** an
  existing actual (never overwrite).
- **Noise floor:** activities under ~0.25 mi are skipped.

| Situation (per family, per day) | Outcome |
|---|---|
| 1 activity + 1 candidate | **Auto-log** silently (even if distance ≠ prescription — ambiguity is about *which workout*, not target attainment) |
| ≥2 candidates, or ≥2 activities | **Confirm card** — attach each activity to a workout, or keep as its own extra card |
| Activity, 0 candidates | **Confirm card → extra card** (athlete confirms inclusion) |
| Sub-noise-floor, unsupported activity type, or `source_id` already seen | **Skip** |

Nothing runnable/rideable is silently dropped except sub-noise-floor and
unsupported activity types.

## Field mapping

| Actual column | Running | Cycling |
|---|---|---|
| `dist` | meters → miles, 2 dp | same |
| `time` | duration → `H:MM:SS` | same |
| `pace` | derived dist÷time, `M:SS/mi` | **null** (not meaningful; card shows dist · time) |
| `hr` | avg HR or null | same |
| `feel`, `note` | null | null |
| `source` | `apple_health` | `apple_health` |
| `source_id` | HK workout UUID | same |
| `recorded_at` | run start time | same |
| `workout_id` | matched workout, or null (standalone) | same |

## Backend (one migration)

- `alter type actual_source add value 'apple_health'` — **must not be used in
  the same transaction** (Postgres restriction); split the migration so the
  enum addition commits before any statement references the value.
- `alter table workout_actuals add column source_id text` + partial unique
  index `(athlete_id, source_id) where source_id is not null` → idempotent
  sync, including standalone rows.

Verified free rides (no changes needed):
- RLS `actuals_write` already permits `workout_id is null` for the athlete.
- One-actual-per-workout index is already partial (`where workout_id is not null`).
- `workout_actuals` is already in the `supabase_realtime` publication — coach
  updates stream live.

## Surfacing

**Athlete (iOS):**
- Auto-logged workouts appear exactly as manual logs do today (done status,
  logged actuals on cards).
- **Extra runs/rides** render as their own completed card in the headliner
  stack and week list — tagged as from Health, showing logged dist · time
  (· pace for runs) — and sink faded to the bottom like any completed card.
- **Confirm card**: shows the Health activity (type, dist, time, start); actions
  = attach to one of the day's candidate workouts / keep as extra card. From a
  background wake, a local notification ("Confirm your run" / "Confirm your
  ride") opens it.
- Settings gains a "Connect Apple Health" row (authorization state; deep-link
  to Settings if denied).

**Coach (web):**
- Standalone actuals fetched by athlete + date range (`workout_id is null`,
  bucketed by `recorded_at` local date) via a new query in the existing
  `lib/queries/actuals.ts`; rendered as an "Extra run · 5.2 mi" (or ride) card
  on the day in week and month views. Realtime keeps it live.

## Error handling

- **Auth denied/restricted** → sync no-ops silently; Settings shows connect state. Never blocks the plan UI.
- **Partial failure** (actual saved, mark-done failed) → refresh so the actual surfaces; next pass retries mark-done; `source_id` prevents double-insert.
- **Duplicate insert** → unique-violation on `(athlete_id, source_id)` treated as "already synced," not an error.
- **Background wake with no plan loaded** → coordinator loads the needed day(s) first; on load failure, enqueue nothing and let the next foreground pass retry.
- **Observer handler** always calls the HealthKit completion handler.
- **Timezones** → all day-bucketing uses the activity's local calendar date.

## Testing

- **HealthMatcher (CI, pure):** table-driven — auto 1:1; two candidates → confirm; two runs → confirm; run+ride vs easy+cross → both auto; ride w/o cross → standalone; logged workout excluded; noise-floor skip; unsupported type skip; seen `source_id` skip.
- **HealthSyncCoordinator (CI, fakes):** routing (auto→write, ambiguous→queue), `lastSync` advancement, idempotent re-run, pending queue persistence.
- **HealthKitGateway:** thin adapter; manual on-device verification (gated on paid account + entitlement).
- **coach-web:** unit test for the standalone-card rendering + query.
- Live integration tests (`lib/queries/*.test.ts`) extended for the standalone fetch, run manually against dev.

## Out of scope (v1)

- Activities other than running/cycling (walking, swimming, hiking…).
- Writing anything back to Health.
- Avg-speed display for rides; auto-matching `other`-type workouts.
- Server-side matching or webhook-based sync (Garmin/Strava direct).

## Rollout prerequisite

HealthKit entitlement + background delivery require a paid Apple Developer
Program membership and a provisioning profile carrying the entitlement
(`project.yml` gains the HealthKit capability + usage strings in Info.plist).
All matcher/coordinator logic is CI-testable without a device; on-device
verification happens once enrollment completes.
