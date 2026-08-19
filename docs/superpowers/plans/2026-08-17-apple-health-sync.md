# Apple Health Live Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-log Apple Health runs/rides against the athlete's plan (silently when unambiguous, one-tap confirm otherwise), with off-plan activities stored as standalone "extra" cards visible to athlete and coach.

**Architecture:** A provider-neutral iOS sync layer (`ActivityProvider` protocol → HealthKit gateway; pure `HealthMatcher`; `HealthSyncCoordinator` + persisted `SyncState`) writes ordinary `workout_actuals` rows through Supabase. One migration adds the `apple_health` source + `(athlete_id, source, source_id)` dedup. Coach-web gains a standalone-actuals query + "Extra run/ride" cards.

**Tech Stack:** SwiftUI/iOS 17, swift-testing (`import Testing`), HealthKit, supabase-swift, XcodeGen; Postgres migrations; React 18 + TS strict + TanStack Query + Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-apple-health-sync-design.md`

## Global Constraints

- Work on branch `feat/health-sync` cut from `origin/dev`; merge commits, never delete branches; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- iOS: Swift 5.10, iOS 17.0 target, tests use swift-testing (`@Suite`/`@Test`/`#expect`), NOT XCTest. After ADDING any Swift file run `xcodegen generate` in `apps/athlete-ios/` before building.
- iOS build/test commands (from `apps/athlete-ios/`):
  - Build: `xcodebuild build -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro" -quiet` (if that simulator name is missing, use the booted device id from `xcrun simctl list devices available`).
  - Test: same command with `test` instead of `build`.
- coach-web (from `apps/coach-web/`): `npm run test:unit` (excludes `lib/queries/**` — those are LIVE integration tests, do not run in CI), `npm run build`, `npm run lint` (0 errors required; warnings exist and are OK). TypeScript strict, Tailwind tokens only, no emoji icons (inline SVG), a11y labels on interactive controls.
- Storage canon: distance = miles, pace = `M:SS/mi`, elapsed time = `M:SS`/`H:MM:SS` strings. Noise floor = **0.25 mi**. Sync overlap window = **6 hours**.
- Never overwrite an existing actual; dedup via `(athlete_id, source, source_id)`.
- Kind inference for standalone rows (both apps): `pace == null` → ride, else run (synced runs always have a derived pace; v1 standalone rows only come from sync).
- Supabase: dev project `bawezljwxehadmkjeydw`; `supabase db push` targets the linked project — link to dev, never prod (prod deploys via CI on merge to main).

---

### Task 1: Migration — `apple_health` source + `source_id` dedup

**Files:**
- Create: `supabase/migrations/20260817120000_apple_health_source.sql`

**Interfaces:**
- Produces: enum value `'apple_health'` on `actual_source`; column `workout_actuals.source_id text`; partial unique index `workout_actuals_source_dedup` on `(athlete_id, source, source_id)`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git fetch origin && git checkout -b feat/health-sync origin/dev
```

- [ ] **Step 2: Write the migration**

```sql
-- Apple Health sync: new actuals source + provider-scoped external id.
-- source_id is the provider's stable workout id (HealthKit UUID); the partial
-- unique index makes every sync pass idempotent — including standalone rows
-- (workout_id null), which have no workout to dedup on. Keying by source too
-- means future providers (garmin, coros) can never collide on an id.
-- NOTE: the new enum value is added but NOT used in this migration (Postgres
-- forbids using a value added in the same transaction).

alter type actual_source add value if not exists 'apple_health';

alter table workout_actuals add column if not exists source_id text;

create unique index if not exists workout_actuals_source_dedup
  on workout_actuals (athlete_id, source, source_id)
  where source_id is not null;
```

- [ ] **Step 3: Apply to dev and verify**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
supabase link --project-ref bawezljwxehadmkjeydw   # if not already linked
supabase db push
```
Expected: the new migration applies cleanly. Verify:
```bash
supabase db execute --sql "select enum_range(null::actual_source);" 2>/dev/null || echo "verify in dashboard: enum has apple_health"
```
Expected output contains `apple_health`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260817120000_apple_health_source.sql
git commit -m "feat(db): apple_health actuals source + source_id dedup index

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: iOS data layer — `WorkoutActual` fields + `PlanStore` write signatures

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Lib/Models.swift` (WorkoutActual struct)
- Modify: `apps/athlete-ios/RecBuddy/Stores/PlanStore.swift` (`logRun`, `updateRun`)
- Test: `apps/athlete-ios/RecBuddyTests/ModelsTests.swift` (append one test)

**Interfaces:**
- Produces: `WorkoutActual` gains `sourceId: String?`, `recordedAt: String?`, and `pace` becomes `String?` (rides have no pace). `PlanStore.logRun(workout:dist:time:pace:hr:feel:note:)` and `PlanStore.updateRun(actualId:dist:time:pace:hr:feel:note:)` take `pace: String?`. (Sync writes do NOT go through `logRun` — they use `SupabaseLogSink`, Task 7 — so `logRun` gains no source params.)
- Consumes: Task 1's `source_id` column.

- [ ] **Step 1: Write the failing decode test** — append to `ModelsTests.swift` inside the `@Suite struct ModelsTests`:

```swift
    @Test func decodesActualWithSourceIdAndNullPace() throws {
        let json = """
        {"id":"a1","workout_id":null,"athlete_id":"u1","dist":12.4,"pace":null,
         "time":"52:10","hr":128,"feel":null,"note":null,"source":"apple_health",
         "source_id":"HK-UUID-1","recorded_at":"2026-08-17T14:03:22+00:00"}
        """.data(using: .utf8)!
        let a = try decoder.decode(WorkoutActual.self, from: json)
        #expect(a.workoutId == nil)
        #expect(a.pace == nil)
        #expect(a.sourceId == "HK-UUID-1")
        #expect(a.recordedAt == "2026-08-17T14:03:22+00:00")
    }
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/athlete-ios
xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro" -quiet 2>&1 | grep -E "error:|Test.*failed|BUILD" | head
```
Expected: compile error — `WorkoutActual` has no `sourceId`.

- [ ] **Step 3: Update the model** — in `Models.swift`, replace the `WorkoutActual` struct with:

```swift
struct WorkoutActual: Codable, Identifiable, Equatable {
    let id: String
    let workoutId: String?
    let athleteId: String
    let dist: Double
    let pace: String?            // nil for rides — pace is a running concept
    let time: String
    let hr: Int?
    let feel: Int?
    let note: String?
    let source: String
    let sourceId: String?        // provider's stable id (HealthKit UUID); nil for manual
    let recordedAt: String?      // timestamptz — the activity's start time for synced rows
    enum CodingKeys: String, CodingKey {
        case id, dist, pace, time, hr, feel, note, source
        case workoutId = "workout_id"
        case athleteId = "athlete_id"
        case sourceId = "source_id"
        case recordedAt = "recorded_at"
    }
}
```

- [ ] **Step 4: Update `PlanStore.logRun` and `updateRun`** — in `PlanStore.swift`, change the two signatures and the insert struct:

```swift
    /// Save a manual actual and mark the workout done. `pace` is optional so
    /// the extra-activity edit flow (rides have no pace) reuses updateRun.
    /// Sync writes go through SupabaseLogSink, not this method.
    func logRun(workout: Workout, dist: Double, time: String, pace: String?,
                hr: Int?, feel: Int?, note: String?) async throws {
        struct ExistingRow: Decodable { let id: String }
        let existing: [ExistingRow] = try await Supa.shared.from("workout_actuals")
            .select("id").eq("workout_id", value: workout.id).limit(1).execute().value
        if let row = existing.first {
            try await updateRun(actualId: row.id, dist: dist, time: time, pace: pace,
                                hr: hr, feel: feel, note: note)
        } else {
            struct NewActual: Encodable {
                let workout_id: String
                let athlete_id: String
                let dist: Double
                let pace: String?
                let time: String
                let hr: Int?
                let feel: Int?
                let note: String?
                let source: String
            }
            let row = NewActual(workout_id: workout.id, athlete_id: workout.athleteId,
                                dist: dist, pace: pace, time: time, hr: hr, feel: feel,
                                note: note, source: "manual")
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        }
        do {
            try await setStatus(workout, to: "done")
        } catch {
            await refresh() // surface the saved actual even though mark-done failed
            throw error
        }
        await refresh()
    }
```

And in `updateRun`, change the parameter and the patch line for pace:

```swift
    func updateRun(actualId: String, dist: Double, time: String, pace: String?,
                   hr: Int?, feel: Int?, note: String?) async throws {
        let patch: [String: AnyJSON] = [
            "dist": .double(dist),
            "pace": pace.map { .string($0) } ?? .null,
            "time": .string(time),
            "hr": hr.map { .integer($0) } ?? .null,
            "feel": feel.map { .integer($0) } ?? .null,
            "note": note.map { .string($0) } ?? .null,
        ]
        try await Supa.shared.from("workout_actuals")
            .update(patch).eq("id", value: actualId).execute()
        await refresh()
    }
```

(Existing call sites in `LogRunSheet.swift`/`WorkoutDetailSheet.swift` pass a non-optional `String` for `pace` and omit the new defaulted params — they compile unchanged. `Units.fmtPace`/`Pace.toSeconds` already take `String?`.)

- [ ] **Step 5: Run tests to verify pass**

Same command as Step 2. Expected: `** TEST SUCCEEDED **` (all suites green).

- [ ] **Step 6: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Lib/Models.swift apps/athlete-ios/RecBuddy/Stores/PlanStore.swift apps/athlete-ios/RecBuddyTests/ModelsTests.swift
git commit -m "feat(ios): actuals carry source_id/recorded_at; pace optional for rides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `ActivitySample` types + pure `HealthMatcher` (TDD)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Health/ActivitySample.swift`
- Create: `apps/athlete-ios/RecBuddy/Health/HealthMatcher.swift`
- Test: `apps/athlete-ios/RecBuddyTests/HealthMatcherTests.swift`

**Interfaces:**
- Produces (used by every later task):

```swift
enum ActivitySource: String, Codable { case appleHealth = "apple_health" }
enum ActivityKind: String, Codable { case running, cycling, other }
struct ActivitySample: Codable, Equatable, Identifiable {
    let sourceId: String; let source: ActivitySource; let startDate: Date
    let distanceMeters: Double; let durationSeconds: Int; let avgHR: Int?
    let kind: ActivityKind
    var id: String { sourceId }
    var miles: Double { (distanceMeters / 1609.344 * 100).rounded() / 100 }
}
protocol ActivityProvider {
    func requestAuthorization() async throws
    func fetchActivities(since: Date) async throws -> [ActivitySample]
    func startObserving(_ onChange: @escaping () async -> Void)
}
enum SkipReason: Equatable { case belowNoiseFloor, unsupportedKind, excluded }
enum MatchOutcome: Equatable {
    case autoLog(workoutId: String)
    case needsConfirm(candidateWorkoutIds: [String])
    case standalone
    case skip(SkipReason)
}
enum HealthMatcher {
    static let noiseFloorMiles = 0.25
    static func candidateTypes(for kind: ActivityKind) -> Set<String>?
    static func localDay(of date: Date, calendar: Calendar) -> String
    static func classify(activity: ActivitySample, dayActivities: [ActivitySample],
                         dayWorkouts: [Workout], loggedWorkoutIds: Set<String>,
                         excludedSourceIds: Set<String>) -> MatchOutcome
}
```

- [ ] **Step 1: Write `ActivitySample.swift`** (plain types, no logic to test on their own):

```swift
import Foundation

/// Provider-neutral activity value — the ONLY shape the matcher, coordinator,
/// confirm UI, and write paths ever see. Adding a provider (Garmin, Coros)
/// adds zero matching or UI logic.
enum ActivitySource: String, Codable { case appleHealth = "apple_health" }

enum ActivityKind: String, Codable { case running, cycling, other }

struct ActivitySample: Codable, Equatable, Identifiable {
    let sourceId: String        // provider's stable id (HealthKit workout UUID)
    let source: ActivitySource
    let startDate: Date
    let distanceMeters: Double
    let durationSeconds: Int
    let avgHR: Int?
    let kind: ActivityKind
    var id: String { sourceId }
    /// Canonical storage distance (miles, 2 dp).
    var miles: Double { (distanceMeters / 1609.344 * 100).rounded() / 100 }
}

/// One activity source. HealthKitGateway is the first implementation; tests
/// inject fakes; future providers slot in beside it.
protocol ActivityProvider {
    func requestAuthorization() async throws
    func fetchActivities(since: Date) async throws -> [ActivitySample]
    /// Register for change callbacks (HK observer + background delivery).
    /// The provider must call its own completion plumbing AFTER `onChange` returns.
    func startObserving(_ onChange: @escaping () async -> Void)
}
```

- [ ] **Step 2: Write the failing matcher tests** — `HealthMatcherTests.swift`:

```swift
import Testing
import Foundation
@testable import RecBuddy

@Suite struct HealthMatcherTests {
    // Builders
    func run(_ id: String, miles: Double = 5, kind: ActivityKind = .running) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth,
                       startDate: Date(timeIntervalSince1970: 1_787_000_000),
                       distanceMeters: miles * 1609.344,
                       durationSeconds: Int(miles * 540), avgHR: 150, kind: kind)
    }
    func workout(_ id: String, type: String) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-17", type: type,
                title: type.capitalized, dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: "planned")
    }
    func classify(_ a: ActivitySample, day: [ActivitySample]? = nil, ws: [Workout],
                  logged: Set<String> = [], excluded: Set<String> = []) -> MatchOutcome {
        HealthMatcher.classify(activity: a, dayActivities: day ?? [a], dayWorkouts: ws,
                               loggedWorkoutIds: logged, excludedSourceIds: excluded)
    }

    @Test func oneRunOneCandidateAutoLogs() {
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")]) == .autoLog(workoutId: "w1"))
    }
    @Test func twoCandidatesNeedConfirm() {
        let ws = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        #expect(classify(run("r1"), ws: ws) == .needsConfirm(candidateWorkoutIds: ["w1", "w2"]))
    }
    @Test func twoRunsSameDayNeedConfirm() {
        let a = run("r1"), b = run("r2")
        #expect(classify(a, day: [a, b], ws: [workout("w1", type: "easy")])
                == .needsConfirm(candidateWorkoutIds: ["w1"]))
    }
    @Test func runAndRideDoNotCrossAmbiguate() {
        let r = run("r1"), ride = run("c1", kind: .cycling)
        let ws = [workout("w1", type: "easy"), workout("w2", type: "cross")]
        #expect(classify(r, day: [r, ride], ws: ws) == .autoLog(workoutId: "w1"))
        #expect(classify(ride, day: [r, ride], ws: ws) == .autoLog(workoutId: "w2"))
    }
    @Test func rideWithoutCrossDayIsStandalone() {
        #expect(classify(run("c1", kind: .cycling), ws: [workout("w1", type: "easy")]) == .standalone)
    }
    @Test func loggedWorkoutIsNeverACandidate() {
        // The only candidate already has an actual -> never overwrite -> standalone.
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")], logged: ["w1"]) == .standalone)
    }
    @Test func restAndOtherTypesAreNotCandidates() {
        let ws = [workout("w1", type: "rest"), workout("w2", type: "other")]
        #expect(classify(run("r1"), ws: ws) == .standalone)
    }
    @Test func noiseFloorSkips() {
        #expect(classify(run("r1", miles: 0.2), ws: [workout("w1", type: "easy")])
                == .skip(.belowNoiseFloor))
    }
    @Test func unsupportedKindSkips() {
        #expect(classify(run("s1", kind: .other), ws: []) == .skip(.unsupportedKind))
    }
    @Test func excludedSourceIdSkips() {
        #expect(classify(run("r1"), ws: [workout("w1", type: "easy")], excluded: ["r1"])
                == .skip(.excluded))
    }
    @Test func excludedSiblingDoesNotCountTowardAmbiguity() {
        let a = run("r1"), b = run("r2")
        #expect(classify(a, day: [a, b], ws: [workout("w1", type: "easy")], excluded: ["r2"])
                == .autoLog(workoutId: "w1"))
    }
}
```

- [ ] **Step 3: Regenerate project + run tests to verify failure**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/athlete-ios
xcodegen generate
xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro" -quiet 2>&1 | grep -E "error:|BUILD" | head
```
Expected: compile error — `HealthMatcher` not defined.

- [ ] **Step 4: Write `HealthMatcher.swift`**:

```swift
import Foundation

/// Pure classification of one provider activity against one day's plan.
/// No HealthKit, no network, no store — the correctness core, fully unit-tested.
/// Ambiguity is judged WITHIN an activity family (running vs cycling) so a run
/// and a ride on the same day never make each other ambiguous.
enum HealthMatcher {
    static let noiseFloorMiles = 0.25
    static let runningTypes: Set<String> = ["easy", "long", "speed", "tempo", "recovery", "race"]

    /// Workout types an activity kind may attach to; nil = unsupported kind.
    static func candidateTypes(for kind: ActivityKind) -> Set<String>? {
        switch kind {
        case .running: return runningTypes
        case .cycling: return ["cross"]
        case .other:   return nil
        }
    }

    /// Local calendar day ('YYYY-MM-DD') of an activity — matches plan day keys.
    static func localDay(of date: Date, calendar: Calendar = .current) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func classify(activity: ActivitySample,
                         dayActivities: [ActivitySample],
                         dayWorkouts: [Workout],
                         loggedWorkoutIds: Set<String>,
                         excludedSourceIds: Set<String>) -> MatchOutcome {
        if excludedSourceIds.contains(activity.sourceId) { return .skip(.excluded) }
        guard let types = candidateTypes(for: activity.kind) else { return .skip(.unsupportedKind) }
        if activity.miles < noiseFloorMiles { return .skip(.belowNoiseFloor) }

        // Candidates: same family, not already logged (never overwrite).
        let candidates = dayWorkouts.filter { types.contains($0.type) && !loggedWorkoutIds.contains($0.id) }
        if candidates.isEmpty { return .standalone }

        // Family siblings that will actually be considered (excluded/noise don't ambiguate).
        let familyCount = dayActivities.filter {
            $0.kind == activity.kind && !excludedSourceIds.contains($0.sourceId) && $0.miles >= noiseFloorMiles
        }.count

        if candidates.count == 1 && familyCount == 1 { return .autoLog(workoutId: candidates[0].id) }
        return .needsConfirm(candidateWorkoutIds: candidates.map(\.id))
    }
}

enum SkipReason: Equatable { case belowNoiseFloor, unsupportedKind, excluded }

enum MatchOutcome: Equatable {
    case autoLog(workoutId: String)
    case needsConfirm(candidateWorkoutIds: [String])
    case standalone
    case skip(SkipReason)
}
```

- [ ] **Step 5: Run tests to verify pass**

Same command as Step 3. Expected: `** TEST SUCCEEDED **`, all 11 matcher tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Health apps/athlete-ios/RecBuddyTests/HealthMatcherTests.swift
git commit -m "feat(ios): provider-neutral ActivitySample + pure HealthMatcher

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Standalone actuals in `PlanStore` + `Week.localDay` helper

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Lib/Week.swift` (append helper)
- Modify: `apps/athlete-ios/RecBuddy/Stores/PlanStore.swift`
- Test: `apps/athlete-ios/RecBuddyTests/WeekTests.swift` (append)

**Interfaces:**
- Produces: `Week.localDay(fromTimestamp:calendar:) -> String?`; `PlanStore.standaloneByDate: [String: [WorkoutActual]]` (populated by `refresh()`); `PlanStore.deleteActual(id:)`. (Standalone INSERTS live only in `SupabaseLogSink.logStandalone`, Task 7 — one write path, no duplication.)
- Consumes: model fields (Task 2).

- [ ] **Step 1: Write the failing `Week.localDay` tests** — append inside `WeekTests.swift`'s suite:

```swift
    @Test func localDayParsesSupabaseTimestamps() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        // 2026-08-18 02:03 UTC == Aug 17 in LA (fractional + non-fractional forms).
        #expect(Week.localDay(fromTimestamp: "2026-08-18T02:03:22.123456+00:00", calendar: cal) == "2026-08-17")
        #expect(Week.localDay(fromTimestamp: "2026-08-18T02:03:22+00:00", calendar: cal) == "2026-08-17")
        #expect(Week.localDay(fromTimestamp: "not a date", calendar: cal) == nil)
    }
```

- [ ] **Step 2: Run tests to verify failure** (same xcodebuild test command). Expected: compile error — no `localDay`.

- [ ] **Step 3: Implement in `Week.swift`** (append inside `enum Week`):

```swift
    /// Supabase timestamptz -> local 'YYYY-MM-DD'. Strips fractional seconds
    /// first (Postgres emits 6 digits; ISO8601DateFormatter only parses 3).
    static func localDay(fromTimestamp ts: String, calendar: Calendar = .current) -> String? {
        let stripped = ts.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        let iso = ISO8601DateFormatter()
        guard let date = iso.date(from: stripped) else { return nil }
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }
```

- [ ] **Step 4: Run tests to verify pass.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Extend `PlanStore`** — add the cache property next to `actualsByWorkout`:

```swift
    /// Off-plan "extra" runs/rides (workout_id null) for the displayed week,
    /// keyed by LOCAL day of recorded_at.
    private(set) var standaloneByDate: [String: [WorkoutActual]] = [:]
```

In `refresh()`, after the `actualsByWorkout` block (still inside `do`, before `phase = .idle`), add:

```swift
            // Standalone extras: fetch a padded UTC range, bucket by local day.
            let padFrom = Week.addDays(from, -1) + "T00:00:00+00:00"
            let padTo = Week.addDays(to, 2) + "T00:00:00+00:00"
            let extras: [WorkoutActual] = try await Supa.shared.from("workout_actuals")
                .select().is("workout_id", value: nil)
                .gte("recorded_at", value: padFrom).lt("recorded_at", value: padTo)
                .order("recorded_at").execute().value
            guard weekMonday == from else { return } // stale response — a newer week won
            let wanted = Set(Week.weekDates(mondayIso: from))
            standaloneByDate = Dictionary(grouping: extras.filter { a in
                guard let ts = a.recordedAt, let day = Week.localDay(fromTimestamp: ts) else { return false }
                return wanted.contains(day)
            }, by: { Week.localDay(fromTimestamp: $0.recordedAt ?? "") ?? "" })
```

Append one method at the end of the class:

```swift
    /// Delete an actual row (used by the extra-card delete flow; the caller
    /// records the source_id in the excluded set so sync never re-imports it).
    func deleteActual(id: String) async throws {
        try await Supa.shared.from("workout_actuals").delete().eq("id", value: id).execute()
        await refresh()
    }
```

- [ ] **Step 6: Build + full test run.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 7: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Lib/Week.swift apps/athlete-ios/RecBuddy/Stores/PlanStore.swift apps/athlete-ios/RecBuddyTests/WeekTests.swift
git commit -m "feat(ios): standalone extras cache + local-day bucketing in PlanStore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `SyncState` — persisted per-provider sync state (TDD)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Health/SyncState.swift`
- Test: `apps/athlete-ios/RecBuddyTests/SyncStateTests.swift`

**Interfaces:**
- Produces:

```swift
struct PendingCandidate: Codable, Equatable { let id: String; let title: String; let type: String }
struct PendingActivity: Codable, Equatable, Identifiable {
    let sample: ActivitySample; let candidates: [PendingCandidate]
    var id: String { sample.sourceId }
}
@Observable @MainActor final class SyncState {
    init(provider: String = "apple_health", defaults: UserDefaults = .standard)
    var connected: Bool          // persisted; user completed the connect flow
    var autoSyncEnabled: Bool    // persisted; Settings toggle
    var lastSync: Date?          // persisted; nil until first pass
    private(set) var excludedSourceIds: Set<String>  // dismissed or deleted
    private(set) var pending: [PendingActivity]
    func exclude(_ sourceId: String)
    func addPending(_ p: PendingActivity)   // no-op if same sourceId already queued
    func removePending(sourceId: String)
    func markSynced(at date: Date)
}
```

- [ ] **Step 1: Write the failing tests** — `SyncStateTests.swift`:

```swift
import Testing
import Foundation
@testable import RecBuddy

@Suite @MainActor struct SyncStateTests {
    func freshDefaults() -> UserDefaults {
        let d = UserDefaults(suiteName: "SyncStateTests-\(UUID().uuidString)")!
        return d
    }
    func sample(_ id: String) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth, startDate: Date(timeIntervalSince1970: 1_787_000_000),
                       distanceMeters: 8046.72, durationSeconds: 2700, avgHR: nil, kind: .running)
    }

    @Test func persistsToggleExclusionsAndPendingAcrossInstances() {
        let d = freshDefaults()
        let s1 = SyncState(defaults: d)
        s1.connected = true
        s1.autoSyncEnabled = true
        s1.exclude("hk-1")
        s1.addPending(PendingActivity(sample: sample("hk-2"),
                                      candidates: [PendingCandidate(id: "w1", title: "Easy Run", type: "easy")]))
        s1.markSynced(at: Date(timeIntervalSince1970: 1_787_000_000))

        let s2 = SyncState(defaults: d) // fresh instance = relaunch
        #expect(s2.connected == true)
        #expect(s2.autoSyncEnabled == true)
        #expect(s2.excludedSourceIds.contains("hk-1"))
        #expect(s2.pending.count == 1)
        #expect(s2.pending[0].candidates[0].title == "Easy Run")
        #expect(s2.lastSync == Date(timeIntervalSince1970: 1_787_000_000))
    }
    @Test func addPendingDedupsBySourceId() {
        let s = SyncState(defaults: freshDefaults())
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        #expect(s.pending.count == 1)
    }
    @Test func removePendingRemoves() {
        let s = SyncState(defaults: freshDefaults())
        s.addPending(PendingActivity(sample: sample("hk-2"), candidates: []))
        s.removePending(sourceId: "hk-2")
        #expect(s.pending.isEmpty)
    }
}
```

- [ ] **Step 2: xcodegen + run to verify failure.** Expected: compile error — `SyncState` not defined.

- [ ] **Step 3: Implement `SyncState.swift`**:

```swift
import Foundation
import Observation

struct PendingCandidate: Codable, Equatable { let id: String; let title: String; let type: String }

/// An activity awaiting the athlete's decision (attach / keep as extra / dismiss).
struct PendingActivity: Codable, Equatable, Identifiable {
    let sample: ActivitySample
    let candidates: [PendingCandidate]   // that day's attachable workouts
    var id: String { sample.sourceId }
}

/// Per-provider persisted sync state (UserDefaults, keys namespaced by provider
/// from day one so Garmin/Coros get their own). Everything survives relaunch:
/// pending confirmations from a background wake are never lost, and excluded
/// ids (dismissed or deleted activities) are never re-imported.
@Observable @MainActor
final class SyncState {
    private let defaults: UserDefaults
    private let ns: String
    private let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    private let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    var connected: Bool { didSet { defaults.set(connected, forKey: ns + "connected") } }
    var autoSyncEnabled: Bool { didSet { defaults.set(autoSyncEnabled, forKey: ns + "autoSync") } }
    private(set) var lastSync: Date?
    private(set) var excludedSourceIds: Set<String>
    private(set) var pending: [PendingActivity]

    init(provider: String = "apple_health", defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.ns = "health.\(provider)."
        self.connected = defaults.bool(forKey: ns + "connected")
        self.autoSyncEnabled = defaults.bool(forKey: ns + "autoSync")
        self.lastSync = defaults.object(forKey: ns + "lastSync") as? Date
        self.excludedSourceIds = Set(defaults.stringArray(forKey: ns + "excluded") ?? [])
        if let data = defaults.data(forKey: ns + "pending"),
           let decoded = try? decoder.decode([PendingActivity].self, from: data) {
            self.pending = decoded
        } else {
            self.pending = []
        }
    }

    func exclude(_ sourceId: String) {
        excludedSourceIds.insert(sourceId)
        defaults.set(Array(excludedSourceIds), forKey: ns + "excluded")
    }
    func addPending(_ p: PendingActivity) {
        guard !pending.contains(where: { $0.id == p.id }) else { return }
        pending.append(p)
        persistPending()
    }
    func removePending(sourceId: String) {
        pending.removeAll { $0.id == sourceId }
        persistPending()
    }
    func markSynced(at date: Date) {
        lastSync = date
        defaults.set(date, forKey: ns + "lastSync")
    }
    private func persistPending() {
        defaults.set((try? encoder.encode(pending)) ?? Data(), forKey: ns + "pending")
    }
}
```

- [ ] **Step 4: Run tests to verify pass.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Health/SyncState.swift apps/athlete-ios/RecBuddyTests/SyncStateTests.swift
git commit -m "feat(ios): persisted per-provider SyncState (toggle, exclusions, pending)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `HealthSyncCoordinator` (TDD with fakes)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Health/HealthSyncCoordinator.swift`
- Test: `apps/athlete-ios/RecBuddyTests/HealthSyncCoordinatorTests.swift`

**Interfaces:**
- Produces:

```swift
protocol ActivityLogSink {
    /// Everything the matcher needs about one plan day, straight from the DB
    /// (works from a background wake with no store cache loaded).
    /// knownSourceIds = source_ids of actuals ALREADY in the DB that day's range
    /// — merged into the excluded set so re-fetched activities reclassify as skip.
    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>)
    func logAttached(_ sample: ActivitySample, workoutId: String) async throws
    func logStandalone(_ sample: ActivitySample) async throws
}
@MainActor final class HealthSyncCoordinator {
    static let overlapSeconds: TimeInterval = 6 * 3600
    static let firstSyncLookbackDays = 7
    init(provider: ActivityProvider, sink: ActivityLogSink, state: SyncState,
         calendar: Calendar = .current, now: @escaping () -> Date = Date.init)
    /// One pass. Returns the number of NEWLY queued pending confirmations
    /// (caller decides whether to notify). No-ops when auto-sync is off.
    func sync() async -> Int
    /// Resolve a pending confirmation.
    enum Resolution { case attach(workoutId: String), standalone, dismiss }
    func resolve(_ pendingId: String, _ resolution: Resolution) async throws
}
```

- Consumes: `HealthMatcher.classify`/`localDay` (Task 3), `SyncState` (Task 5).

- [ ] **Step 1: Write the failing tests** — `HealthSyncCoordinatorTests.swift`:

```swift
import Testing
import Foundation
@testable import RecBuddy

@MainActor
final class FakeProvider: ActivityProvider {
    var samples: [ActivitySample] = []
    var thrown: Error?
    var fetchedSince: Date?
    func requestAuthorization() async throws {}
    func fetchActivities(since: Date) async throws -> [ActivitySample] {
        fetchedSince = since
        if let thrown { throw thrown }
        return samples
    }
    func startObserving(_ onChange: @escaping () async -> Void) {}
}

@MainActor
final class FakeSink: ActivityLogSink {
    var workouts: [Workout] = []
    var loggedIds: Set<String> = []
    var knownSourceIds: Set<String> = []
    var attached: [(String, String)] = []   // (sourceId, workoutId)
    var standalones: [String] = []
    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>) {
        (workouts, loggedIds, knownSourceIds)
    }
    func logAttached(_ sample: ActivitySample, workoutId: String) async throws {
        attached.append((sample.sourceId, workoutId))
        loggedIds.insert(workoutId)             // mirrors the DB: workout now logged
        knownSourceIds.insert(sample.sourceId)
    }
    func logStandalone(_ sample: ActivitySample) async throws {
        standalones.append(sample.sourceId)
        knownSourceIds.insert(sample.sourceId)
    }
}

@Suite @MainActor struct HealthSyncCoordinatorTests {
    let t0 = Date(timeIntervalSince1970: 1_787_000_000)
    func sample(_ id: String, kind: ActivityKind = .running, miles: Double = 5) -> ActivitySample {
        ActivitySample(sourceId: id, source: .appleHealth, startDate: t0,
                       distanceMeters: miles * 1609.344, durationSeconds: 2700, avgHR: nil, kind: kind)
    }
    func workout(_ id: String, type: String) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: HealthMatcher.localDay(of: t0),
                type: type, title: type, dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: "planned")
    }
    func make(_ provider: FakeProvider, _ sink: FakeSink) -> (HealthSyncCoordinator, SyncState) {
        let state = SyncState(defaults: UserDefaults(suiteName: "CoordTests-\(UUID().uuidString)")!)
        state.autoSyncEnabled = true
        let c = HealthSyncCoordinator(provider: provider, sink: sink, state: state, now: { self.t0 })
        return (c, state)
    }

    @Test func autoLogsUnambiguousAndAdvancesLastSync() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(s.attached.map(\.1) == ["w1"])
        #expect(newPending == 0)
        #expect(state.lastSync == t0)
    }
    @Test func ambiguousGoesToPendingWithCandidates() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(newPending == 1)
        #expect(state.pending.first?.candidates.map(\.id) == ["w1", "w2"])
        #expect(s.attached.isEmpty)
    }
    @Test func standaloneOutcomeGoesToPendingWithNoCandidates() async {
        let p = FakeProvider(); p.samples = [sample("c1", kind: .cycling)]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        #expect(state.pending.first?.candidates.isEmpty == true) // confirm-to-include, per spec
        #expect(s.standalones.isEmpty)                            // nothing written yet
    }
    @Test func autoSyncOffIsANoOp() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        state.autoSyncEnabled = false
        _ = await c.sync()
        #expect(s.attached.isEmpty)
        #expect(p.fetchedSince == nil)   // never even fetched
        #expect(state.lastSync == nil)
    }
    @Test func fetchFailureDoesNotAdvanceLastSync() async {
        struct Boom: Error {}
        let p = FakeProvider(); p.thrown = Boom()
        let (c, state) = make(p, FakeSink())
        _ = await c.sync()
        #expect(state.lastSync == nil)
    }
    @Test func resyncOverlapIsIdempotent() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, _) = make(p, s)
        _ = await c.sync()
        _ = await c.sync()   // overlap re-fetches r1; knownSourceIds now contains it
        #expect(s.attached.count == 1)
    }
    @Test func excludedIdsNeverReimport() async {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        state.exclude("r1")   // athlete dismissed or deleted it earlier
        _ = await c.sync()
        #expect(s.attached.isEmpty)
        #expect(state.pending.isEmpty)
    }
    @Test func twoRunsQueueTwoPendings() async {
        let p = FakeProvider(); p.samples = [sample("r1"), sample("r2")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        let newPending = await c.sync()
        #expect(newPending == 2)
        #expect(state.pending.count == 2)
    }
    @Test func resolveAttachWritesAndClearsPending() async throws {
        let p = FakeProvider(); p.samples = [sample("r1")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy"), workout("w2", type: "tempo")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("r1", .attach(workoutId: "w2"))
        #expect(s.attached.map(\.1) == ["w2"])
        #expect(state.pending.isEmpty)
    }
    @Test func resolveStandaloneWritesExtra() async throws {
        let p = FakeProvider(); p.samples = [sample("c1", kind: .cycling)]
        let s = FakeSink()
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("c1", .standalone)
        #expect(s.standalones == ["c1"])
        #expect(state.pending.isEmpty)
    }
    @Test func resolveDismissExcludes() async throws {
        let p = FakeProvider(); p.samples = [sample("r1"), sample("r2")]
        let s = FakeSink(); s.workouts = [workout("w1", type: "easy")]
        let (c, state) = make(p, s)
        _ = await c.sync()
        try await c.resolve("r1", .dismiss)
        #expect(state.excludedSourceIds.contains("r1"))
        #expect(state.pending.map(\.id) == ["r2"])
    }
}
```

- [ ] **Step 2: xcodegen + run to verify failure.** Expected: compile error — no `HealthSyncCoordinator`/`ActivityLogSink`.

- [ ] **Step 3: Implement `HealthSyncCoordinator.swift`**:

```swift
import Foundation

/// Everything the matcher needs about one plan day, straight from the DB —
/// works from a background wake with no store cache loaded.
protocol ActivityLogSink {
    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>)
    func logAttached(_ sample: ActivitySample, workoutId: String) async throws
    func logStandalone(_ sample: ActivitySample) async throws
}

/// Orchestrates one sync pass over a provider: fetch since lastSync (with an
/// overlap window), classify per local day via HealthMatcher, route outcomes.
/// Ambiguous/standalone activities queue as pending confirmations; the caller
/// (HealthSyncService) decides whether to notify. Gated by the Settings toggle.
@MainActor
final class HealthSyncCoordinator {
    static let overlapSeconds: TimeInterval = 6 * 3600
    static let firstSyncLookbackDays = 7

    private let provider: ActivityProvider
    private let sink: ActivityLogSink
    let state: SyncState
    private let calendar: Calendar
    private let now: () -> Date

    init(provider: ActivityProvider, sink: ActivityLogSink, state: SyncState,
         calendar: Calendar = .current, now: @escaping () -> Date = Date.init) {
        self.provider = provider
        self.sink = sink
        self.state = state
        self.calendar = calendar
        self.now = now
    }

    func sync() async -> Int {
        guard state.autoSyncEnabled else { return 0 }
        let passStart = now()
        let since = (state.lastSync ?? passStart.addingTimeInterval(
            -Double(Self.firstSyncLookbackDays) * 86_400)).addingTimeInterval(-Self.overlapSeconds)
        guard let samples = try? await provider.fetchActivities(since: since) else { return 0 }

        var newPending = 0
        var allDaysSucceeded = true
        let byDay = Dictionary(grouping: samples) { HealthMatcher.localDay(of: $0.startDate, calendar: calendar) }
        for (day, dayActivities) in byDay.sorted(by: { $0.key < $1.key }) {
            guard let ctx = try? await sink.dayContext(day) else { allDaysSucceeded = false; continue }
            var logged = ctx.loggedWorkoutIds
            // Known DB source_ids + user exclusions both mean "don't touch".
            var excluded = state.excludedSourceIds.union(ctx.knownSourceIds)
            for activity in dayActivities.sorted(by: { $0.startDate < $1.startDate }) {
                let outcome = HealthMatcher.classify(activity: activity, dayActivities: dayActivities,
                                                     dayWorkouts: ctx.workouts, loggedWorkoutIds: logged,
                                                     excludedSourceIds: excluded)
                switch outcome {
                case .autoLog(let workoutId):
                    if (try? await sink.logAttached(activity, workoutId: workoutId)) != nil {
                        logged.insert(workoutId)       // a second sample reclassifies correctly
                        excluded.insert(activity.sourceId)
                    } else {
                        allDaysSucceeded = false
                    }
                case .needsConfirm(let candidateIds):
                    let candidates = ctx.workouts.filter { candidateIds.contains($0.id) }
                        .map { PendingCandidate(id: $0.id, title: $0.title, type: $0.type) }
                    if !state.pending.contains(where: { $0.id == activity.sourceId }) { newPending += 1 }
                    state.addPending(PendingActivity(sample: activity, candidates: candidates))
                case .standalone:
                    // Confirm-to-include per spec: queue with no candidates.
                    if !state.pending.contains(where: { $0.id == activity.sourceId }) { newPending += 1 }
                    state.addPending(PendingActivity(sample: activity, candidates: []))
                case .skip:
                    break
                }
            }
        }
        if allDaysSucceeded { state.markSynced(at: passStart) }
        return newPending
    }

    enum Resolution { case attach(workoutId: String), standalone, dismiss }

    func resolve(_ pendingId: String, _ resolution: Resolution) async throws {
        guard let p = state.pending.first(where: { $0.id == pendingId }) else { return }
        switch resolution {
        case .attach(let workoutId): try await sink.logAttached(p.sample, workoutId: workoutId)
        case .standalone:            try await sink.logStandalone(p.sample)
        case .dismiss:               state.exclude(p.sample.sourceId)
        }
        state.removePending(sourceId: pendingId)
    }
}
```

- [ ] **Step 4: Run tests to verify pass.** Expected: `** TEST SUCCEEDED **`, all coordinator tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Health/HealthSyncCoordinator.swift apps/athlete-ios/RecBuddyTests/HealthSyncCoordinatorTests.swift
git commit -m "feat(ios): HealthSyncCoordinator — classify, route, confirm queue, idempotent passes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `HealthKitGateway` + Supabase sink + entitlements

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Health/HealthKitGateway.swift`
- Create: `apps/athlete-ios/RecBuddy/Health/SupabaseLogSink.swift`
- Modify: `apps/athlete-ios/project.yml` (entitlements + usage string)

**Interfaces:**
- Consumes: `ActivityProvider`, `ActivityLogSink`, `PlanStore.insertStandaloneActual` (via its own inserts — see below).
- Produces: `HealthKitGateway: ActivityProvider`; `SupabaseLogSink: ActivityLogSink` (`init(athleteId: String)`).

- [ ] **Step 1: Add HealthKit capability to `project.yml`** — inside `targets: RecBuddy:` add an `entitlements:` block (sibling of `info:`), and add the usage string under `info.properties`:

```yaml
    entitlements:
      path: RecBuddy/RecBuddy.entitlements
      properties:
        com.apple.developer.healthkit: true
        com.apple.developer.healthkit.background-delivery: true
```

Under `info: properties:` add:

```yaml
        NSHealthShareUsageDescription: RecBuddy reads your recorded runs and rides to automatically log completed workouts against your training plan.
```

- [ ] **Step 2: Write `HealthKitGateway.swift`** (thin adapter — no unit tests; verified on device once the paid account lands):

```swift
import Foundation
import HealthKit

/// The ONLY component that touches HKHealthStore. Maps HKWorkout -> the
/// provider-neutral ActivitySample. Safe on simulator: isHealthDataAvailable
/// guards every call.
final class HealthKitGateway: ActivityProvider {
    private let store = HKHealthStore()

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let read: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKQuantityType(.heartRate),
            HKQuantityType(.distanceWalkingRunning),
            HKQuantityType(.distanceCycling),
        ]
        try await store.requestAuthorization(toShare: [], read: read)
    }

    func fetchActivities(since: Date) async throws -> [ActivitySample] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { cont in
            let q = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
                if let error { cont.resume(throwing: error) }
                else { cont.resume(returning: (samples as? [HKWorkout]) ?? []) }
            }
            store.execute(q)
        }
        return workouts.map { w in
            let kind: ActivityKind = switch w.workoutActivityType {
                case .running: .running
                case .cycling: .cycling
                default: .other
            }
            let distType: HKQuantityType = kind == .cycling
                ? HKQuantityType(.distanceCycling) : HKQuantityType(.distanceWalkingRunning)
            let meters = w.statistics(for: distType)?.sumQuantity()?
                .doubleValue(for: .meter()) ?? 0
            let hr = w.statistics(for: HKQuantityType(.heartRate))?.averageQuantity()?
                .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            return ActivitySample(sourceId: w.uuid.uuidString, source: .appleHealth,
                                  startDate: w.startDate, distanceMeters: meters,
                                  durationSeconds: Int(w.duration.rounded()),
                                  avgHR: hr.map { Int($0.rounded()) }, kind: kind)
        }
    }

    func startObserving(_ onChange: @escaping () async -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let q = HKObserverQuery(sampleType: .workoutType(), predicate: nil) { _, completion, _ in
            // ALWAYS complete, success or failure, so iOS keeps delivering.
            Task { await onChange(); completion() }
        }
        store.execute(q)
        store.enableBackgroundDelivery(for: .workoutType(), frequency: .immediate) { _, _ in }
    }
}
```

- [ ] **Step 3: Write `SupabaseLogSink.swift`** — DB-backed sink (independent of PlanStore caches, so it works from a background wake):

```swift
import Foundation
import Supabase

/// ActivityLogSink backed by Supabase directly — no dependence on PlanStore's
/// week cache, so a background wake can classify and write on its own. A
/// unique-violation on (athlete_id, source, source_id) means "already synced"
/// and is treated as success, not an error.
@MainActor
final class SupabaseLogSink: ActivityLogSink {
    private let athleteId: String
    init(athleteId: String) { self.athleteId = athleteId }

    func dayContext(_ day: String) async throws
        -> (workouts: [Workout], loggedWorkoutIds: Set<String>, knownSourceIds: Set<String>) {
        let workouts: [Workout] = try await Supa.shared.from("workouts")
            .select().eq("date", value: day).order("created_at").execute().value
        struct Row: Decodable { let workout_id: String?; let source_id: String? }
        var logged = Set<String>(), known = Set<String>()
        if !workouts.isEmpty {
            let rows: [Row] = try await Supa.shared.from("workout_actuals")
                .select("workout_id, source_id")
                .in("workout_id", values: workouts.map(\.id)).execute().value
            logged = Set(rows.compactMap(\.workout_id))
            known = Set(rows.compactMap(\.source_id))
        }
        // Standalone rows near this day (padded UTC window) also count as known.
        struct SRow: Decodable { let source_id: String? }
        let srows: [SRow] = try await Supa.shared.from("workout_actuals")
            .select("source_id").is("workout_id", value: nil)
            .gte("recorded_at", value: Week.addDays(day, -1) + "T00:00:00+00:00")
            .lt("recorded_at", value: Week.addDays(day, 2) + "T00:00:00+00:00")
            .execute().value
        known.formUnion(srows.compactMap(\.source_id))
        return (workouts, logged, known)
    }

    func logAttached(_ sample: ActivitySample, workoutId: String) async throws {
        struct NewActual: Encodable {
            let workout_id: String; let athlete_id: String; let dist: Double
            let pace: String?; let time: String; let hr: Int?
            let source: String; let source_id: String; let recorded_at: String
        }
        let pace = sample.kind == .running
            ? Pace.derive(miles: sample.miles, totalSeconds: sample.durationSeconds) : nil
        let row = NewActual(workout_id: workoutId, athlete_id: athleteId, dist: sample.miles,
                            pace: pace, time: Pace.timeString(fromSeconds: sample.durationSeconds),
                            hr: sample.avgHR, source: sample.source.rawValue,
                            source_id: sample.sourceId,
                            recorded_at: ISO8601DateFormatter().string(from: sample.startDate))
        do {
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        } catch {
            // 23505 unique violation on the dedup index = already synced -> success.
            guard "\(error)".contains("23505") || "\(error)".contains("duplicate key") else { throw error }
        }
        try await Supa.shared.rpc("mark_workout_status",
            params: ["p_workout_id": workoutId, "p_status": "done"]).execute()
    }

    func logStandalone(_ sample: ActivitySample) async throws {
        struct NewStandalone: Encodable {
            let athlete_id: String; let dist: Double; let pace: String?
            let time: String; let hr: Int?; let source: String
            let source_id: String; let recorded_at: String
        }
        let pace = sample.kind == .running
            ? Pace.derive(miles: sample.miles, totalSeconds: sample.durationSeconds) : nil
        let row = NewStandalone(athlete_id: athleteId, dist: sample.miles, pace: pace,
                                time: Pace.timeString(fromSeconds: sample.durationSeconds),
                                hr: sample.avgHR, source: sample.source.rawValue,
                                source_id: sample.sourceId,
                                recorded_at: ISO8601DateFormatter().string(from: sample.startDate))
        do {
            try await Supa.shared.from("workout_actuals").insert(row).execute()
        } catch {
            guard "\(error)".contains("23505") || "\(error)".contains("duplicate key") else { throw error }
        }
    }
}
```

- [ ] **Step 4: Regenerate + build + full tests**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/athlete-ios
xcodegen generate
xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro" -quiet 2>&1 | grep -E "error:|BUILD|TEST" | head
```
Expected: `** TEST SUCCEEDED **`. (Simulator builds fine with the HealthKit entitlement; free signing only blocks *device* installs.)

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Health apps/athlete-ios/project.yml
git commit -m "feat(ios): HealthKit gateway, Supabase log sink, HealthKit entitlements

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `HealthSyncService` wiring + app hookup

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Health/HealthSyncService.swift`
- Modify: `apps/athlete-ios/RecBuddy/App/RecBuddyApp.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift` (sync on load/refresh)

**Interfaces:**
- Produces: `@Observable @MainActor final class HealthSyncService` with `state: SyncState`, `func connect(athleteId: String) async`, `func syncNow(athleteId: String, background: Bool = false) async`, `func resolve(_ pendingId: String, _ r: HealthSyncCoordinator.Resolution) async throws`, `func exclude(sourceId: String)`. Injected via `.environment(health)`.
- Consumes: Tasks 5–7.

- [ ] **Step 1: Write `HealthSyncService.swift`**:

```swift
import Foundation
import Observation
import UserNotifications

/// App-facing wiring hub: owns the gateway + state, builds a coordinator per
/// athlete, requests notification permission at connect, and posts the
/// "Confirm your run/ride" local notification after a background pass.
@Observable @MainActor
final class HealthSyncService {
    let state = SyncState()
    private let gateway = HealthKitGateway()
    private var coordinator: HealthSyncCoordinator?
    private var observing = false

    private func coordinator(for athleteId: String) -> HealthSyncCoordinator {
        if let coordinator { return coordinator }
        let c = HealthSyncCoordinator(provider: gateway, sink: SupabaseLogSink(athleteId: athleteId), state: state)
        coordinator = c
        return c
    }

    /// Connect flow from Settings: HK read auth + notification permission,
    /// flip the toggle on, start observing, run a first pass.
    func connect(athleteId: String) async {
        try? await gateway.requestAuthorization()
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])
        state.connected = true
        state.autoSyncEnabled = true
        await syncNow(athleteId: athleteId)
        startObservingIfNeeded(athleteId: athleteId)
    }

    /// One pass; from a background wake, notify if anything needs confirming.
    func syncNow(athleteId: String, background: Bool = false) async {
        let newPending = await coordinator(for: athleteId).sync()
        if background && newPending > 0 {
            let content = UNMutableNotificationContent()
            content.title = "RecBuddy"
            let kinds = Set(state.pending.map(\.sample.kind))
            content.body = kinds == [.cycling] ? "Confirm your ride" : "Confirm your run"
            try? await UNUserNotificationCenter.current().add(
                UNNotificationRequest(identifier: "health-confirm", content: content, trigger: nil))
        }
    }

    /// Register the HK observer once per launch (no-op until connected).
    func startObservingIfNeeded(athleteId: String) {
        guard state.connected, state.autoSyncEnabled, !observing else { return }
        observing = true
        gateway.startObserving { [weak self] in
            await self?.syncNow(athleteId: athleteId, background: true)
        }
    }

    func resolve(_ pendingId: String, _ r: HealthSyncCoordinator.Resolution) async throws {
        guard let coordinator else { return }
        try await coordinator.resolve(pendingId, r)
    }

    func exclude(sourceId: String) { state.exclude(sourceId) }
}
```

- [ ] **Step 2: Inject in `RecBuddyApp.swift`** — replace the struct body with:

```swift
@main
struct RecBuddyApp: App {
    @State private var session = SessionStore()
    @State private var health = HealthSyncService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(health)
                .task { await session.start() }
                .preferredColorScheme(.dark)
                .tint(RB.accent)
                // recbuddy:// just foregrounds the app; session comes from normal sign-in (v1)
                .onOpenURL { _ in }
        }
    }
}
```

- [ ] **Step 3: Sync from `CalendarView`** — add the environment near the top of `CalendarView`:

```swift
    @Environment(HealthSyncService.self) private var health
```

Change the existing `.task { await store.refresh() }` and `.refreshable { await store.refresh() }` lines to run a sync first (sync writes, then the refresh picks the rows up):

```swift
            .refreshable {
                await health.syncNow(athleteId: profile.id)
                await store.refresh()
            }
```
```swift
        .task {
            health.startObservingIfNeeded(athleteId: profile.id)
            await health.syncNow(athleteId: profile.id)
            await store.refresh()
        }
```

(`profile: Profile` is already a property of `CalendarView`; `profile.id` is the athlete id.)

- [ ] **Step 4: Regenerate, build, run full tests.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Health/HealthSyncService.swift apps/athlete-ios/RecBuddy/App/RecBuddyApp.swift apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(ios): HealthSyncService wired into app launch, calendar load, pull-to-refresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Confirm UI — pending banner + `ConfirmActivitySheet`

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Calendar/ConfirmActivitySheet.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift` (banner + sheet)

**Interfaces:**
- Consumes: `HealthSyncService.state.pending`, `.resolve(_:_:)` (Task 8); `TypeBadge`, `RB` tokens, `Units`/`Week` helpers.

- [ ] **Step 1: Write `ConfirmActivitySheet.swift`**:

```swift
import SwiftUI

/// Pending Health activities awaiting a decision. Each row: attach to one of
/// that day's workouts, keep as its own extra card, or dismiss (never
/// re-imported). Rows disappear as they're resolved; the sheet closes itself
/// when none remain.
struct ConfirmActivitySheet: View {
    @Environment(HealthSyncService.self) private var health
    let store: PlanStore
    let unit: Unit
    @Environment(\.dismiss) private var dismiss
    @State private var busyId: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }
                        ForEach(health.state.pending) { p in
                            row(p)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Confirm activities")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(RB.accent)
                }
            }
            .onChange(of: health.state.pending.isEmpty) { _, empty in
                if empty { dismiss() }
            }
        }
    }

    private func row(_ p: PendingActivity) -> some View {
        let isRide = p.sample.kind == .cycling
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: isRide ? "bicycle" : "figure.run")
                    .foregroundStyle(RB.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(isRide ? "Ride" : "Run")
                        .font(.subheadline.weight(.bold)).foregroundStyle(.white)
                    Text("\(Week.fmtDayDate(HealthMatcher.localDay(of: p.sample.startDate))) · \(Units.fmtDist(p.sample.miles, unit)) \(unit.rawValue) · \(Pace.timeString(fromSeconds: p.sample.durationSeconds))")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                if busyId == p.id { ProgressView() }
            }
            // Attach options (that day's candidate workouts)
            ForEach(p.candidates, id: \.id) { c in
                Button { resolve(p, .attach(workoutId: c.id)) } label: {
                    HStack {
                        TypeBadge(type: c.type)
                        Text("Log as “\(c.title)”").font(.footnote.weight(.semibold))
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption2)
                    }
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 10) {
                Button { resolve(p, .standalone) } label: {
                    Text(isRide ? "Keep as extra ride" : "Keep as extra run")
                        .font(.footnote.weight(.semibold)).frame(maxWidth: .infinity)
                }
                .buttonStyle(VoltButtonStyle())
                Button { resolve(p, .dismiss) } label: {
                    Text("Dismiss").font(.footnote.weight(.semibold))
                        .foregroundStyle(RB.textMute).padding(.horizontal, 14)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .rbCard()
        .disabled(busyId != nil)
    }

    private func resolve(_ p: PendingActivity, _ r: HealthSyncCoordinator.Resolution) {
        busyId = p.id; error = nil
        Task {
            do {
                try await health.resolve(p.id, r)
                await store.refresh()
            } catch {
                self.error = "Couldn't save — try again."
            }
            busyId = nil
        }
    }
}
```

(`Week.fmtDayDate` takes an ISO `YYYY-MM-DD` string — already exists; `VoltButtonStyle` and `rbCard()` already exist.)

- [ ] **Step 2: Banner + sheet in `CalendarView`** — add state near `accountOpen`:

```swift
    @State private var confirmOpen = false
```

In the main `VStack` (directly under the `noCoachBanner` block), add:

```swift
                    if !health.state.pending.isEmpty {
                        Button { confirmOpen = true } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "heart.text.square.fill").foregroundStyle(RB.accent)
                                Text("\(health.state.pending.count) \(health.state.pending.count == 1 ? "activity" : "activities") to confirm")
                                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(RB.textFaint)
                            }
                            .padding(14)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .rbCard(highlighted: true)
                    }
```

Next to the other `.sheet` modifiers add:

```swift
        .sheet(isPresented: $confirmOpen) {
            ConfirmActivitySheet(store: store, unit: unit)
        }
```

- [ ] **Step 3: Regenerate, build, full tests.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/ConfirmActivitySheet.swift apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(ios): confirm banner + sheet for ambiguous/off-plan Health activities

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Athlete extra cards — headliner tabs, week rows, detail sheet

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Calendar/ExtraActivitySheet.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift`

**Interfaces:**
- Consumes: `PlanStore.standaloneByDate`, `.updateRun`, `.deleteActual` (Tasks 2/4); `HealthSyncService.exclude(sourceId:)` (Task 8).
- Kind rule: `actual.pace == nil` → ride, else run.

- [ ] **Step 1: Write `ExtraActivitySheet.swift`** (view + edit + delete):

```swift
import SwiftUI

/// Detail for an off-plan extra run/ride: shows the logged values, allows the
/// same edits as a logged run (distance + elapsed time; pace re-derives for
/// runs), and delete. Deleting also excludes the source id so sync never
/// re-imports the same activity.
struct ExtraActivitySheet: View {
    let actual: WorkoutActual
    let store: PlanStore
    let unit: Unit
    @Environment(HealthSyncService.self) private var health
    @Environment(\.dismiss) private var dismiss
    @State private var dist: String
    @State private var time: String
    @State private var busy = false
    @State private var confirmDelete = false
    @State private var error: String?

    private var isRide: Bool { actual.pace == nil }

    init(actual: WorkoutActual, store: PlanStore, unit: Unit) {
        self.actual = actual
        self.store = store
        self.unit = unit
        _dist = State(initialValue: Units.fmtDist(actual.dist, unit))
        _time = State(initialValue: actual.time)
    }

    private var miles: Double? {
        guard let d = Double(dist), d > 0 else { return nil }
        return (Units.toMiles(d, unit) * 100).rounded() / 100
    }
    private var seconds: Int? { Pace.timeToSeconds(time) }

    var body: some View {
        NavigationStack {
            ZStack {
                RB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(spacing: 10) {
                            Image(systemName: isRide ? "bicycle" : "figure.run").foregroundStyle(RB.accent)
                            Text(isRide ? "Extra ride" : "Extra run")
                                .font(.title3.weight(.bold)).foregroundStyle(.white)
                            Spacer()
                            Text("from Health").font(.caption).foregroundStyle(RB.textFaint)
                        }
                        if let ts = actual.recordedAt, let day = Week.localDay(fromTimestamp: ts) {
                            Text(Week.fmtDayDate(day)).font(.caption).foregroundStyle(RB.textMute)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("DISTANCE (\(unit.rawValue.uppercased()))")
                            TextField("4.5", text: $dist).keyboardType(.decimalPad)
                                .foregroundStyle(.white).rbField()
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            RBLabel("TOTAL TIME")
                            TextField("45:00", text: $time)
                                .foregroundStyle(.white).rbField()
                        }
                        if let hr = actual.hr {
                            VStack(alignment: .leading, spacing: 8) {
                                RBLabel("AVG HEART RATE")
                                Text("\(hr) bpm").font(.body.weight(.semibold)).foregroundStyle(.white)
                            }
                        }
                        if let error { Text(error).font(.footnote).foregroundStyle(.red) }

                        Button(busy ? "Saving…" : "Save changes") { Task { await save() } }
                            .buttonStyle(VoltButtonStyle())
                            .disabled(busy || miles == nil || seconds == nil)

                        Button("Delete activity") { confirmDelete = true }
                            .font(.footnote.weight(.semibold)).foregroundStyle(.red)
                            .frame(maxWidth: .infinity)
                            .disabled(busy)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Extra activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(RB.accent)
                }
            }
            .confirmationDialog("Delete this activity?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await remove() } }
            }
        }
    }

    private func save() async {
        guard let miles, let seconds else { return }
        busy = true; error = nil; defer { busy = false }
        let pace = isRide ? nil : Pace.derive(miles: miles, totalSeconds: seconds)
        do {
            try await store.updateRun(actualId: actual.id, dist: miles,
                                      time: Pace.timeString(fromSeconds: seconds), pace: pace,
                                      hr: actual.hr, feel: actual.feel, note: actual.note)
            dismiss()
        } catch { self.error = "Couldn't save — try again." }
    }

    private func remove() async {
        busy = true; error = nil; defer { busy = false }
        do {
            if let sid = actual.sourceId { health.exclude(sourceId: sid) } // never re-import
            try await store.deleteActual(id: actual.id)
            dismiss()
        } catch { self.error = "Couldn't delete — try again." }
    }
}
```

- [ ] **Step 2: Extra tabs + week rows in `CalendarView`** — add state + selection near `selected`:

```swift
    @State private var selectedExtra: WorkoutActual?
```

Add a computed property near `todayWorkouts`:

```swift
    private var todayExtras: [WorkoutActual] {
        store.standaloneByDate[Week.todayISO()] ?? []
    }
```

In `todayStack`, after the `ForEach(Array(behind.enumerated())...)` block (inside the same `VStack`), add extra tabs (same drawer-tab language, faded like completed):

```swift
                ForEach(Array(todayExtras.enumerated()), id: \.element.id) { i, a in
                    extraSliver(a)
                        .padding(.top, (behind.isEmpty && i == 0) ? -12 : -16)
                        .zIndex(Double(-(i + 1)))
                }
```

Append the tab view below `todaySliver`:

```swift
    /// Off-plan extra activity as a completed-style tab behind the stack.
    private func extraSliver(_ a: WorkoutActual) -> some View {
        let isRide = a.pace == nil
        let tab = UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 16,
                                         bottomTrailingRadius: 16, topTrailingRadius: 0)
        return Button { selectedExtra = a } label: {
            HStack(spacing: 12) {
                Image(systemName: isRide ? "bicycle" : "figure.run")
                    .font(.footnote).foregroundStyle(RB.accent).frame(width: 30)
                Text(isRide ? "Extra ride" : "Extra run")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                    Text("\(Units.fmtDist(a.dist, unit)) \(unit.rawValue)")
                }
                .font(.caption2.weight(.semibold)).foregroundStyle(RB.accent)
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
            }
            .padding(.horizontal, 14)
            .padding(.top, 18)
            .padding(.bottom, 11)
            .frame(maxWidth: .infinity)
            .background(RB.surface2, in: tab)
            .overlay(tab.stroke(RB.line, lineWidth: 1))
            .opacity(0.55)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
```

In `weekSection`, inside the `ForEach(workoutDays...)` replacement — change the day loop so extra rows render after each day's workouts, and days with ONLY extras still appear. Replace:

```swift
            let workoutDays = store.weekDates.filter { !(store.workoutsByDate[$0] ?? []).isEmpty }
```
with:
```swift
            let workoutDays = store.weekDates.filter {
                !(store.workoutsByDate[$0] ?? []).isEmpty || !(store.standaloneByDate[$0] ?? []).isEmpty
            }
```
and inside the day `ForEach`, after the existing inner `ForEach(store.workoutsByDate[date] ?? [], ...)`, add:

```swift
                    ForEach(store.standaloneByDate[date] ?? [], id: \.id) { a in
                        extraWeekRow(date: date, actual: a)
                    }
```

Append the row view below `weekDayCard`:

```swift
    private func extraWeekRow(date: String, actual a: WorkoutActual) -> some View {
        let isRide = a.pace == nil
        let dowIndex = store.weekDates.firstIndex(of: date) ?? 0
        return Button { selectedExtra = a } label: {
            HStack(spacing: 12) {
                VStack(spacing: 2) {
                    Text(Week.DOW[dowIndex].uppercased())
                        .font(.caption2.weight(.bold)).foregroundStyle(RB.textFaint)
                    Text(String(Int(date.suffix(2)) ?? 0))
                        .font(.body.weight(.bold)).foregroundStyle(RB.textMute)
                }
                .frame(width: 40)
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(RB.surface2).frame(width: 36, height: 36)
                    Image(systemName: isRide ? "bicycle" : "figure.run")
                        .font(.footnote).foregroundStyle(RB.accent)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(isRide ? "Extra ride" : "Extra run")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    Text("\(Units.fmtDist(a.dist, unit)) \(unit.rawValue) · \(a.time)")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                weekStatusIndicator(isDone: true)
            }
            .padding(12)
            .background(RB.accent.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(RB.line, lineWidth: 1))
            .opacity(0.9)
        }
        .buttonStyle(.plain)
    }
```

Add the sheet next to the others:

```swift
        .sheet(item: $selectedExtra) { a in
            ExtraActivitySheet(actual: a, store: store, unit: unit)
        }
```

- [ ] **Step 3: Regenerate, build, full tests.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/ExtraActivitySheet.swift apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(ios): extra run/ride cards in headliner + week list, editable detail sheet

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Settings — "Connected services" section

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Account/ConnectedServicesSection.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Account/AccountSheet.swift`

**Interfaces:**
- Consumes: `HealthSyncService` (`state.connected`, `state.autoSyncEnabled`, `connect(athleteId:)`).

**Spec deviation (documented):** the spec's "denied → deep-link to iOS Settings"
state cannot be implemented literally — HealthKit deliberately does not expose
read-authorization status to the app (privacy: denial is indistinguishable from
no data). The caption below the toggle pointing at iOS Settings > Privacy &
Security > Health is the honest equivalent.

- [ ] **Step 1: Write `ConnectedServicesSection.swift`** (a list from day one — future providers append):

```swift
import SwiftUI

/// Athlete Settings > Connected services. A LIST of providers (Apple Health is
/// the first; Garmin/Coros append here later). Each row: connection state +
/// the Auto-sync toggle. Toggle off = no foreground or background passes;
/// already-synced records are untouched.
struct ConnectedServicesSection: View {
    let athleteId: String
    @Environment(HealthSyncService.self) private var health
    @State private var connecting = false

    var body: some View {
        @Bindable var state = health.state
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "heart.fill")
                    .foregroundStyle(RB.accent)
                    .frame(width: 34, height: 34)
                    .background(RB.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Apple Health").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    Text(health.state.connected ? "Connected" : "Log runs & rides automatically")
                        .font(.caption).foregroundStyle(RB.textMute)
                }
                Spacer()
                if health.state.connected {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(RB.accent)
                } else {
                    Button(connecting ? "Connecting…" : "Connect") {
                        connecting = true
                        Task { await health.connect(athleteId: athleteId); connecting = false }
                    }
                    .font(.footnote.weight(.semibold)).foregroundStyle(RB.accent)
                    .disabled(connecting)
                }
            }
            if health.state.connected {
                Toggle("Auto-sync", isOn: $state.autoSyncEnabled)
                    .font(.subheadline).foregroundStyle(.white)
                    .tint(RB.accent)
                Text("If Health access was denied, enable it in iOS Settings > Privacy & Security > Health.")
                    .font(.caption2).foregroundStyle(RB.textFaint)
            }
        }
        .padding(14)
        .rbCard()
    }
}
```

- [ ] **Step 2: Add to `AccountSheet`** — in the section stack (line ~38, after `preferencesSection`), add `connectedServicesSection`, and append the builder near `preferencesSection`:

```swift
    private var connectedServicesSection: some View {
        sectionGroup(title: "CONNECTED SERVICES") {
            ConnectedServicesSection(athleteId: profile.id)
        }
    }
```

(`AccountSheet` already has `let profile: Profile` — verify the property name at the top of the file; it is the `profile` passed from `CalendarView`.)

- [ ] **Step 3: Regenerate, build, full tests.** Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Account
git commit -m "feat(ios): Connected services settings — Apple Health connect + auto-sync toggle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: coach-web data — standalone query, bucketing helper, realtime

**Files:**
- Modify: `apps/coach-web/src/lib/types.ts` (Actual)
- Modify: `apps/coach-web/src/lib/week.ts` + Test: `apps/coach-web/src/lib/week.test.ts` (append)
- Modify: `apps/coach-web/src/lib/queries/actuals.ts`
- Modify: `apps/coach-web/src/lib/useRealtimePlan.ts`

**Interfaces:**
- Produces: `Actual.source_id: string | null`; `localDayOf(ts: string): string` in `lib/week.ts`; `useStandaloneActuals(athleteId: string | null, fromIso: string, toIso: string)` returning `Actual[]` (query key `['standalone', athleteId, fromIso, toIso]`).

- [ ] **Step 1: Failing test for `localDayOf`** — append to `src/lib/week.test.ts`:

```ts
test('localDayOf buckets a timestamptz to the local calendar day', () => {
  // Construct from a local wall-clock time so the test passes in any TZ.
  const local = new Date(2026, 7, 17, 22, 30) // Aug 17, 10:30pm local
  expect(localDayOf(local.toISOString())).toBe('2026-08-17')
})
```
Add `localDayOf` to that file's import from `./week`.

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/coach-web
npx vitest run src/lib/week.test.ts 2>&1 | tail -5
```
Expected: FAIL — `localDayOf` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/week.ts`:

```ts
/** timestamptz -> the viewer's LOCAL 'YYYY-MM-DD' (buckets extra runs onto days). */
export function localDayOf(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run to verify pass.** Expected: PASS.

- [ ] **Step 5: Types + query + realtime.** In `types.ts`, add `source_id: string | null` to the `Actual` interface:

```ts
export interface Actual {
  id: string; workout_id: string | null; athlete_id: string; dist: number | null
  pace: string | null; time: string | null; hr: number | null; feel: number | null
  note: string | null; source: string; source_id: string | null; recorded_at: string
}
```

Append to `src/lib/queries/actuals.ts`:

```ts
/** Off-plan "extra" activities (workout_id null) for [fromIso, toIso) — a
 *  padded UTC range; callers bucket by localDayOf(recorded_at). */
export async function fetchStandaloneActuals(
  client: SupabaseClient, athleteId: string, fromIso: string, toIso: string,
): Promise<Actual[]> {
  const { data, error } = await client.from('workout_actuals')
    .select('*').eq('athlete_id', athleteId).is('workout_id', null)
    .gte('recorded_at', fromIso + 'T00:00:00Z').lt('recorded_at', toIso + 'T00:00:00Z')
    .order('recorded_at')
  if (error) throw error
  return (data as Actual[]) ?? []
}

export function useStandaloneActuals(athleteId: string | null, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['standalone', athleteId, fromIso, toIso],
    queryFn: () => fetchStandaloneActuals(supabase, athleteId!, fromIso, toIso),
    enabled: !!athleteId,
  })
}
```

In `useRealtimePlan.ts`, extend the `workout_actuals` handler:

```ts
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_actuals', filter: `athlete_id=eq.${athleteId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['actual'] })
          qc.invalidateQueries({ queryKey: ['standalone', athleteId] })
        })
```

- [ ] **Step 6: Verify** — `npm run test:unit && npm run build && npm run lint`. Expected: all tests pass, build clean, 0 lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/coach-web/src/lib
git commit -m "feat(coach): standalone-actuals query, local-day bucketing, realtime invalidation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: coach-web UI — "Extra run/ride" cards in week + month

**Files:**
- Create: `apps/coach-web/src/features/plan-grid/ExtraActivityCard.tsx`
- Test: `apps/coach-web/src/features/plan-grid/ExtraActivityCard.test.tsx`
- Modify: `apps/coach-web/src/features/plan-grid/WeekGrid.tsx` (render extras per day)
- Modify: `apps/coach-web/src/features/plan-grid/MonthDayModal.tsx` (list extras read-only)
- Modify: `apps/coach-web/src/routes/CoachPage.tsx` (wire hooks)

**Interfaces:**
- Consumes: `useStandaloneActuals`, `localDayOf` (Task 12).
- Produces: `WeekGrid` gains optional prop `extras?: Record<string, Actual[]>`; `MonthDayModal` gains optional prop `extras?: Actual[]`.

- [ ] **Step 1: Failing card test** — `ExtraActivityCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ExtraActivityCard } from './ExtraActivityCard'

const base = { id: 'x1', workout_id: null, athlete_id: 'a', dist: 5.2, pace: '9:00/mi',
  time: '46:48', hr: null, feel: null, note: null, source: 'apple_health',
  source_id: 'hk1', recorded_at: '2026-08-17T14:00:00Z' } as any

test('renders an extra RUN with distance and time', () => {
  render(<ExtraActivityCard actual={base} />)
  expect(screen.getByText(/extra run/i)).toBeInTheDocument()
  expect(screen.getByText(/5\.2 mi · 46:48/)).toBeInTheDocument()
})

test('null pace renders as an extra RIDE', () => {
  render(<ExtraActivityCard actual={{ ...base, pace: null }} />)
  expect(screen.getByText(/extra ride/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/features/plan-grid/ExtraActivityCard.test.tsx`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ExtraActivityCard.tsx`**:

```tsx
import type { Actual } from '../../lib/types'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'

function BikeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6h-4l-3 6.5M12 17.5 15 6l3.5 4.5" />
    </svg>
  )
}
function RunIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4.5" r="1.8" /><path d="M6 20.5 9.5 14l3-2-1 6.5M9 8.5 12.5 7l3 3 3 .8" />
    </svg>
  )
}

/** Off-plan activity from a synced provider — shown on the day like a logged
 *  card but tagged as extra. pace==null means it was a ride. */
export function ExtraActivityCard({ actual }: { actual: Actual }) {
  const { unit } = useUnit()
  const isRide = actual.pace == null
  return (
    <div className="rb-card rb-card-sm flex items-center gap-2 border border-line bg-[rgba(173,255,47,0.06)] p-2">
      {isRide ? <BikeIcon className="h-4 w-4 shrink-0 text-accent" /> : <RunIcon className="h-4 w-4 shrink-0 text-accent" />}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-[13px] font-semibold leading-tight">{isRide ? 'Extra ride' : 'Extra run'}</div>
        {actual.dist != null && (
          <div className="font-num text-xs text-text-mute">{fmtDist(actual.dist, unit)} {unit} · {actual.time}</div>
        )}
      </div>
      <span className="text-sm leading-none text-accent" aria-label="Completed">✓</span>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**, then wire it. In `WeekGrid.tsx`:
  - Add to imports: `import { ExtraActivityCard } from './ExtraActivityCard'` and `import type { Workout, Actual } from '../../lib/types'` (extend the existing type import).
  - `WeekGrid` props gain `extras?: Record<string, Actual[]>`; pass `extras={extras?.[date] ?? []}` into each `DayCell`; `DayCell` props gain `extras: Actual[]`.
  - In `DayCell`, render extras after the workouts stack (works for empty days too — place directly before the `canEdit &&` add-sliver block, in BOTH branches by moving it just inside the drop container after the empty/occupied conditional):

```tsx
        {extras.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {extras.map((a) => <ExtraActivityCard key={a.id} actual={a} />)}
          </div>
        )}
```
  (Place this immediately after the `{workouts.length === 0 ? (...) : (...)}` conditional block, before the closing tag of the drop `div`.)

  In `MonthDayModal.tsx`: add optional prop `extras?: Actual[]` (extend the type import) and, after the workouts `map` inside the scroll container:

```tsx
        {(extras ?? []).map((a) => (
          <div key={a.id} className="rb-card-sm border border-line p-3 opacity-80">
            <ExtraActivityCard actual={a} />
          </div>
        ))}
```
  with `import { ExtraActivityCard } from './ExtraActivityCard'`.

  In `CoachPage.tsx` (`AthleteDashboard`): add imports `useStandaloneActuals` from `../lib/queries/actuals`, `localDayOf` from `../lib/week`; add below the other queries:

```tsx
  // Off-plan extras: fetch a padded window covering week or month view.
  const extrasFrom = view === 'week' ? addDays(monday, -1) : addDays(firstOfMonth(monthAnchor), -8)
  const extrasTo = view === 'week' ? addDays(monday, 8) : addDays(firstOfMonth(monthAnchor), 45)
  const extrasQ = useStandaloneActuals(athleteId, extrasFrom, extrasTo)
  const extrasByDate: Record<string, Actual[]> = {}
  for (const a of extrasQ.data ?? []) {
    const d = localDayOf(a.recorded_at)
    ;(extrasByDate[d] ??= []).push(a)
  }
```
  (add `Actual` to the `types` import), pass `extras={extrasByDate}` to `WeekGrid`, and `extras={extrasByDate[monthModalDate] ?? []}` to `MonthDayModal`.

- [ ] **Step 5: Verify** — `npm run test:unit && npm run build && npm run lint`. Expected: all green, 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add apps/coach-web/src
git commit -m "feat(coach): extra run/ride cards on week days + month day modal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full iOS test + build**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/athlete-ios
xcodegen generate
xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro" -quiet 2>&1 | grep -E "error:|failed|TEST" | head
```
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 2: Full coach-web suite**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy/apps/coach-web
npm run test:unit && npm run build && npm run lint
```
Expected: tests pass, build clean, `0 errors` in lint output.

- [ ] **Step 3: Push + PR into dev** (merge commit, do NOT delete the branch)

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git push -u origin feat/health-sync
gh pr create --base dev --head feat/health-sync \
  --title "Apple Health live sync — auto-log runs/rides, confirm cards, coach extras" \
  --body "Implements docs/superpowers/specs/2026-08-17-apple-health-sync-design.md: provider-neutral sync layer (pure HealthMatcher + coordinator, HealthKit gateway), hybrid auto-log/confirm, standalone extra runs/rides on both apps, per-provider auto-sync toggle, editable synced records, (athlete_id, source, source_id) dedup.

On-device verification (HealthKit entitlement) is gated on the Apple Developer Program enrollment — all matcher/coordinator logic is unit-tested in CI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Report** — summarize test counts, note that on-device HealthKit verification (auth prompt, background delivery, end-to-end log) is pending the paid Apple Developer account, per spec.

---

## Deferred / explicitly out of scope (per spec)

- Athlete month-grid dots for extras (extras appear in headliner + week list + coach views).
- Activities other than running/cycling; write-back to Health; avg-speed for rides.
- Garmin/Coros providers and server-side webhook ingestion (seams in place).
- Live integration tests for the standalone query (`lib/queries/*.test.ts` are run manually against dev; add later alongside other manual suites).
