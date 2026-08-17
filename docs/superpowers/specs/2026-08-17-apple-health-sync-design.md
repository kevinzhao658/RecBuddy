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
| Multi-provider future | **Provider-agnostic core** — matcher/coordinator/write contract are source-neutral; Apple Health is the first `ActivityProvider`, Garmin/Coros slot in later without rework |
| Auto-sync control | **Per-provider toggle in athlete Settings** — off stops all syncing (observer unregistered); already-synced records remain |
| Post-sync edits | **Synced records stay editable** — ordinary actuals, existing edit flow; edits are never clobbered by re-sync; deleted/dismissed activities are never re-imported |
| Prerequisite | Paid Apple Developer Program (HealthKit entitlement; background delivery). User is enrolling |

## Architecture

New iOS layer `apps/athlete-ios/RecBuddy/Health/`, three units with one job each:

### HealthKitGateway (first `ActivityProvider`)
The only component that touches `HKHealthStore`. It implements the
provider-neutral `ActivityProvider` protocol so tests inject a fake and future
providers (Garmin, Coros) slot in beside it — see *Provider extensibility*.
- `requestAuthorization()` — read access: workouts, distance (running+cycling), heart rate.
- `fetchActivities(since: Date) -> [ActivitySample]` — `HKWorkout` samples
  mapped to a plain, provider-neutral value: `sourceId`, `source`
  (`.appleHealth`), `startDate`, `distanceMeters`, `durationSeconds`, `avgHR?`,
  `activity` (`.running` / `.cycling` / `.other`).
- `startObserving(handler:)` — registers `HKObserverQuery` +
  `enableBackgroundDelivery` so a newly recorded workout wakes the app. The
  handler **always** calls HealthKit's completion handler, success or failure.

### HealthMatcher
A **pure function** — no HealthKit, no network, no store. The correctness core
and primary unit-test surface.

```
classify(activity: ActivitySample,      // provider-neutral value
         dayWorkouts: [Workout],        // that local calendar day
         loggedWorkoutIds: Set<String>, // already have an actual
         excludedSourceIds: Set<String>) // synced, dismissed, or deleted
  -> MatchOutcome
```

The matcher never sees a provider type — only `ActivitySample` — so the same
rules apply verbatim to any future source.

`MatchOutcome`: `.autoLog(workoutId)` | `.needsConfirm(candidateWorkoutIds)` |
`.standalone` | `.skip(reason)`.

### HealthSyncCoordinator
Orchestrates a sync pass over any registered `ActivityProvider`; owns
`lastSync`, the pending-confirmation queue, and the excluded-ids set.
- **Gated by the per-provider auto-sync toggle** — when off, no passes run and
  the background observer is unregistered.
- Pull activities since `lastSync` (minus an overlap window; dedup absorbs it).
- Classify each via the matcher; route: auto → `PlanStore.logRun(...)`;
  standalone/ambiguous → pending confirmation (+ local notification when in
  background).
- Persist per provider: `lastSync`, pending confirmations, and
  `excludedSourceIds` (activities the athlete dismissed **or whose synced
  record was later deleted**) — all survive relaunch, so nothing re-imports.

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
| Sub-noise-floor, unsupported activity type, or `source_id` excluded (synced / dismissed / deleted) | **Skip** |

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
  index `(athlete_id, source, source_id) where source_id is not null` →
  idempotent sync, including standalone rows. Keying by `source` too means two
  providers can never collide on an id — the same index serves Garmin/Coros
  later with no further migration.

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
- Settings gains a **"Connected services"** section (built as a list, not a
  one-off row, so future providers append). The Apple Health entry shows
  connection state (connect / connected / denied → deep-link to iOS Settings)
  and an **Auto-sync toggle**: off = no foreground or background sync passes,
  observer unregistered; flipping back on resumes from `lastSync`.
  Already-synced records are untouched by the toggle.

**Editing & deleting synced records:**
- A synced actual is an **ordinary `workout_actuals` row** — the existing
  edit-logged-run flow works on it unchanged (attached records via the workout
  detail sheet as today; the extra-run/ride card opens its own detail with the
  same edit affordance, plus delete).
- Edits stick: never-overwrite + `source_id` dedup mean a later sync pass sees
  the row exists and skips it — an athlete's correction is never clobbered.
- Edits keep `source = apple_health` (the row's origin doesn't change because
  its values were corrected).
- **Deleting** a synced record adds its `source_id` to the excluded set, so the
  next pass doesn't silently re-import the same activity.

**Coach (web):**
- Standalone actuals fetched by athlete + date range (`workout_id is null`,
  bucketed by `recorded_at` local date) via a new query in the existing
  `lib/queries/actuals.ts`; rendered as an "Extra run · 5.2 mi" (or ride) card
  on the day in week and month views. Realtime keeps it live.

## Provider extensibility (Garmin, Coros, …)

Apple Health is the first provider, not a special case. The seams that make the
next one cheap:

- **`ActivityProvider` protocol** (iOS): `requestAuthorization`,
  `fetchActivities(since:)`, optional observation. `HealthKitGateway` is one
  implementation; an on-device Coros/Garmin SDK would be another.
- **`ActivitySample`** is the lingua franca — matcher, coordinator, confirm UI,
  and write paths only ever see this value + its `source` tag. Adding a
  provider adds zero matching or UI logic.
- **The write contract is provider-neutral**: `workout_actuals` with `source`
  (enum — add a value per provider), `source_id`, nullable `workout_id`, and
  the `(athlete_id, source, source_id)` dedup index. Any ingestion path —
  on-device or server-side — targets the same contract.
- **Server-side providers**: Garmin/Coros also offer webhook APIs. If we later
  ingest server-side (an Edge Function receiving webhooks), it writes to the
  same contract; the matching rules in `HealthMatcher` are pure and portable if
  matching must move server-side for that path. Out of scope now, but nothing
  in v1 assumes matching happens on-device.
- **Settings** renders providers as a list; each gets the same
  connect/auto-sync affordances.

Per-provider persisted state (`lastSync`, pending confirmations, excluded ids)
is namespaced by provider from day one.

## Error handling

- **Auth denied/restricted** → sync no-ops silently; Settings shows connect state. Never blocks the plan UI.
- **Partial failure** (actual saved, mark-done failed) → refresh so the actual surfaces; next pass retries mark-done; `source_id` prevents double-insert.
- **Duplicate insert** → unique-violation on `(athlete_id, source_id)` treated as "already synced," not an error.
- **Background wake with no plan loaded** → coordinator loads the needed day(s) first; on load failure, enqueue nothing and let the next foreground pass retry.
- **Observer handler** always calls the HealthKit completion handler.
- **Timezones** → all day-bucketing uses the activity's local calendar date.

## Testing

- **HealthMatcher (CI, pure):** table-driven — auto 1:1; two candidates → confirm; two runs → confirm; run+ride vs easy+cross → both auto; ride w/o cross → standalone; logged workout excluded; noise-floor skip; unsupported type skip; seen `source_id` skip.
- **HealthSyncCoordinator (CI, fakes):** routing (auto→write, ambiguous→queue), `lastSync` advancement, idempotent re-run, pending queue persistence, **auto-sync-off gate (no pass runs)**, and **deleted/dismissed ids never re-import**.
- **HealthKitGateway:** thin adapter; manual on-device verification (gated on paid account + entitlement).
- **coach-web:** unit test for the standalone-card rendering + query.
- Live integration tests (`lib/queries/*.test.ts`) extended for the standalone fetch, run manually against dev.

## Out of scope (v1)

- Activities other than running/cycling (walking, swimming, hiking…).
- Writing anything back to Health.
- Avg-speed display for rides; auto-matching `other`-type workouts.
- Additional providers (Garmin, Coros, Strava) and webhook-based server-side
  ingestion — the seams are in place (see *Provider extensibility*), but only
  Apple Health ships in v1.

## Rollout prerequisite

HealthKit entitlement + background delivery require a paid Apple Developer
Program membership and a provisioning profile carrying the entitlement
(`project.yml` gains the HealthKit capability + usage strings in Info.plist).
All matcher/coordinator logic is CI-testable without a device; on-device
verification happens once enrollment completes.
