# Week Glance Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the athlete week strip + pager with seven glanceable icon-column days driving the existing headliner deck, and revert intensity tints app-wide (both apps).

**Architecture:** Pure `WeekStripLogic` gains a `GlancePair` model (icon + number per activity); a new `WeekGlanceStrip` view renders the columns; `CalendarView` deletes the entire pager machinery and repoints the shipped headliner at `selectedDate` with a "↩ Today" chip. Tint reverts are table restorations in `TypeBadge`/`Icon.tsx`.

**Tech Stack:** SwiftUI (iOS 17, swift-testing), React 18 + TS + Vitest/RTL.

## Global Constraints

- Branch: `feat/week-glance` cut from `fix/week-strip-restore` (contains the pager fixes + specs; PR #50 pending merge — GitHub will show only new commits once it merges). PR into `dev`; normal merges; NEVER delete branches; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; never `git add .`.
- iOS: `xcodegen generate` from `apps/athlete-ios/` after ANY file add/delete. Test command (from `apps/athlete-ios/`): `xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro"`. Baseline: 95 tests / 15 suites green.
- coach-web (from `apps/coach-web/`): `npm run test:unit && npm run build && npm run lint` — 141 tests, 0 lint errors / 36 pre-existing warnings.
- **Untouched surfaces are binding** (spec section): header row, sync badge, confirm banner, mileage gauge, Month/Week toggle, month section, sheets, widget — zero changes.
- Spec: `docs/superpowers/specs/2026-08-21-week-glance-columns-design.md`.
- Tints (exact values): iOS — speed/tempo/race `.orange`, long `.blue`, rest/other `.secondary`, else `.green`. Web — `#FF9F0A` (speed/tempo/race), `#0A84FF` (long), `#30D158` (easy/recovery/cross); rest/other inherit currentColor. Glyphs are NOT touched (cross stays `arrow.2.circlepath`, recovery `heart`, sport ride bicycle).

---

### Task 1: WeekStripLogic v2 — GlancePair model (pure + tests)

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift`
- Modify: `apps/athlete-ios/RecBuddyTests/WeekStripLogicTests.swift`

**Interfaces:**
- Consumes: `Workout` (`type/status/dist/estMinutes/dur`), `WorkoutActual` (`dist`, `declaredActivity`), `Units.fmtDist(_:_:)`, `Unit` (`rawValue` "mi"/"km"), `SportMetrics.meters(fromMiles:)`.
- Produces (Task 4 relies on these exact names):
  - `enum PairIcon: Equatable { case type(String); case sport(String) }`
  - `struct GlancePair: Equatable { let icon: PairIcon; let text: String? }`
  - `WeekStripLogic.pairs(workouts:extras:unit:) -> [GlancePair]`
  - `WeekStripLogic.isRestOnly(workouts:extras:) -> Bool`
  - `WeekStripLogic.defaultSelection(weekDates:today:)` (unchanged)
  - DELETED: `DayMark`, `marks(workouts:extras:)`, `rolloverLanding(forward:weekDates:)`.

- [ ] **Step 1: Rewrite the test file** — keep the two `defaultSelection` tests and the `workout`/`extra` builders; DELETE the rollover and marks tests; ADD:

```swift
    @Test func distanceWorkoutsCarryUnitSuffix() {
        let p = WeekStripLogic.pairs(workouts: [workout("w1", dist: 5)], extras: [], unit: .mi)
        #expect(p == [GlancePair(icon: .type("easy"), text: "5.0 mi")])
    }
    @Test func timeOnlyWorkoutsUseApostropheMinutes() {
        let w = workout("c1", type: "cross", dist: nil, estMinutes: 45)
        #expect(WeekStripLogic.pairs(workouts: [w], extras: [], unit: .mi)
                == [GlancePair(icon: .type("cross"), text: "45'")])
    }
    @Test func noTargetMeansIconOnly() {
        let w = workout("c1", type: "cross", dist: nil, estMinutes: nil)
        #expect(WeekStripLogic.pairs(workouts: [w], extras: [], unit: .mi)
                == [GlancePair(icon: .type("cross"), text: nil)])
    }
    @Test func restWorkoutsAreExcludedFromPairs() {
        #expect(WeekStripLogic.pairs(workouts: [workout("r", type: "rest")], extras: [], unit: .mi).isEmpty)
    }
    @Test func extrasFollowPlannedAndSwimsReadMeters() throws {
        let p = try WeekStripLogic.pairs(
            workouts: [workout("w1", dist: 4)],
            extras: [extra("x1", dist: 12.4, activity: "ride"),
                     extra("x2", dist: 1500 / 1609.344, activity: "swim")],
            unit: .mi)
        #expect(p == [GlancePair(icon: .type("easy"), text: "4.0 mi"),
                      GlancePair(icon: .sport("ride"), text: "12.4 mi"),
                      GlancePair(icon: .sport("swim"), text: "1500m")])
    }
    @Test func restOnlyFlag() {
        #expect(WeekStripLogic.isRestOnly(workouts: [workout("r", type: "rest")], extras: []))
        #expect(!WeekStripLogic.isRestOnly(workouts: [], extras: []))
        #expect(!WeekStripLogic.isRestOnly(workouts: [workout("r", type: "rest"), workout("w")], extras: []))
    }
```

Adjust the builders so they cover the new parameters (keep existing call sites compiling):

```swift
    func workout(_ id: String, type: String = "easy", status: String = "planned",
                 dist: Double? = 5, estMinutes: Int? = nil) -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "W", dist: dist, pace: dist != nil ? "9:00/mi" : nil,
                estMinutes: estMinutes, dur: nil, note: nil, sets: [], status: status)
    }
    func extra(_ id: String, dist: Double = 3.0, activity: String = "ride") throws -> WorkoutActual {
        let json = """
        {"id":"\(id)","workout_id":null,"athlete_id":"a","dist":\(dist),"pace":null,
         "time":"30:00","hr":null,"feel":null,"note":null,"source":"manual",
         "source_id":null,"recorded_at":"2026-08-19T16:00:00+00:00","activity":"\(activity)"}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(WorkoutActual.self, from: json)
    }
```

- [ ] **Step 2: Run to verify failure** — standard iOS test command. Expected: BUILD FAILED (`GlancePair` not found).

- [ ] **Step 3: Implement** — in `WeekStripLogic.swift`, DELETE `DayMark`, `marks`, `rolloverLanding`; ADD:

```swift
/// What one activity renders as in a week-glance column.
enum PairIcon: Equatable {
    case type(String)    // planned workout -> TypeBadge symbol + intensity tint
    case sport(String)   // extra's declared sport -> sport symbol, aerobic green
}
struct GlancePair: Equatable {
    let icon: PairIcon
    let text: String?    // "5.0 mi" / "6.4 km" / "45'" / nil (icon only)
}

extension WeekStripLogic {
    /// Planned non-rest workouts first (distance in the athlete's unit;
    /// time-based targets as apostrophe minutes), then extras (swims in
    /// meters). Pure — drives every column.
    static func pairs(workouts: [Workout], extras: [WorkoutActual], unit: Unit) -> [GlancePair] {
        var out: [GlancePair] = []
        for w in workouts where w.type != "rest" && w.status != "rest" {
            let text: String?
            if let d = w.dist {
                text = "\(Units.fmtDist(d, unit)) \(unit.rawValue)"
            } else if let mins = w.estMinutes ?? w.dur {
                text = "\(mins)'"
            } else {
                text = nil
            }
            out.append(GlancePair(icon: .type(w.type), text: text))
        }
        for a in extras {
            let text = a.declaredActivity == "swim"
                ? "\(SportMetrics.meters(fromMiles: a.dist))m"
                : "\(Units.fmtDist(a.dist, unit)) \(unit.rawValue)"
            out.append(GlancePair(icon: .sport(a.declaredActivity), text: text))
        }
        return out
    }

    /// True when the day is nothing but rest — the column shows the moon.
    static func isRestOnly(workouts: [Workout], extras: [WorkoutActual]) -> Bool {
        !workouts.isEmpty && extras.isEmpty
            && workouts.allSatisfy { $0.type == "rest" || $0.status == "rest" }
    }
}
```

(`WeekStripLogic` stays an `enum` with `defaultSelection` in its original block; the extension keeps the diff readable.)

- [ ] **Step 4: Run to verify pass.** NOTE: `DayStrip.swift` and `CalendarView` still reference the deleted `DayMark`/`marks`/`rolloverLanding` — to keep this task compilable, KEEP thin deprecated shims for one task:

```swift
// TEMPORARY back-compat for DayStrip/CalendarView until Task 4 deletes them.
enum DayMark: Equatable { case none; case allDone; case dots([Bool]) }
extension WeekStripLogic {
    static func marks(workouts: [Workout], extras: [WorkoutActual]) -> DayMark {
        let active = workouts.filter { $0.type != "rest" && $0.status != "rest" }
        let flags = active.map { $0.status == "done" } + extras.map { _ in true }
        if flags.isEmpty { return .none }
        if !flags.contains(false) { return .allDone }
        return .dots(Array(flags.prefix(3)))
    }
    static func rolloverLanding(forward: Bool, weekDates: [String]) -> String {
        (forward ? weekDates.first : weekDates.last) ?? ""
    }
}
```

Task 4 deletes these shims along with their callers. Full suite green (old marks tests are gone, new pairs tests pass).

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift apps/athlete-ios/RecBuddyTests/WeekStripLogicTests.swift
git commit -m "feat(week-glance): GlancePair model — icon + number per activity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: iOS tint revert (TypeBadge)

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Components/TypeBadge.swift`
- Modify: `apps/athlete-ios/RecBuddyTests/TypeBadgeTests.swift`

**Interfaces:** `TypeBadge.tint(for:)` returns the intensity map again; `symbol(for:)` UNCHANGED (cross arrows, recovery heart stay).

- [ ] **Step 1: Update the tests** — replace `everyTypeTintsAccent` with:

```swift
    @Test func intensityTintsRestored() {
        for t in ["speed", "tempo", "race"] { #expect(TypeBadge.tint(for: t) == .orange) }
        #expect(TypeBadge.tint(for: "long") == .blue)
        for t in ["rest", "other"] { #expect(TypeBadge.tint(for: t) == .secondary) }
        for t in ["easy", "recovery", "cross"] { #expect(TypeBadge.tint(for: t) == .green) }
    }
```

Keep the cross/recovery/fallback symbol tests unchanged.

- [ ] **Step 2: Run → FAIL** (tint returns RB.accent).

- [ ] **Step 3: Implement** — restore in `TypeBadge.swift`:

```swift
    /// Intensity code: orange = effort, blue = long, green = aerobic,
    /// muted = off. (Accent-only was tried and reverted — color answers
    /// "which days are hard" at a glance.)
    static func tint(for type: String) -> Color {
        switch type {
        case "speed", "tempo", "race": return .orange
        case "long": return .blue
        case "rest", "other": return .secondary
        default: return .green
        }
    }
```

- [ ] **Step 4: Run → PASS** (full suite).

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Components/TypeBadge.swift apps/athlete-ios/RecBuddyTests/TypeBadgeTests.swift
git commit -m "feat(icons): restore intensity tints on iOS type icons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: coach-web tint revert (Icon.tsx)

**Files:**
- Modify: `apps/coach-web/src/components/ui/Icon.tsx`
- Modify: `apps/coach-web/src/components/ui/Icon.test.tsx`

**Interfaces:** `TypeIcon({ type, className })` — signature unchanged (NO `tinted` prop returns); renders inline `style={{ color }}` for tinted types, inherits `currentColor` for rest/other. Glyphs and `SportIcon` untouched.

- [ ] **Step 1: Update tests** — replace the currentColor test with:

```tsx
test('TypeIcon carries its intensity tint inline; rest inherits currentColor', () => {
  const { container: tempo } = render(<TypeIcon type="tempo" />)
  expect(tempo.querySelector('svg')!.getAttribute('style')).toContain('color: rgb(255, 159, 10)')
  const { container: rest } = render(<TypeIcon type="rest" className="text-text-mute" />)
  expect(rest.querySelector('svg')!.getAttribute('style')).toBeNull()
})
```

Keep the cross-arcs, recovery-heart, and ride-bicycle tests unchanged.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — in `Icon.tsx`, above `TypeIcon`, restore:

```tsx
/** Intensity tints (match athlete iOS): orange = effort, blue = long, green =
 *  aerobic; rest/other inherit the surrounding text color. Accent-only was
 *  tried and reverted — color answers "which days are hard" at a glance. */
const TYPE_TINT: Record<string, string> = {
  speed: '#FF9F0A', tempo: '#FF9F0A', race: '#FF9F0A',
  long: '#0A84FF',
  easy: '#30D158', recovery: '#30D158', cross: '#30D158',
}

export function TypeIcon({ type, className = '' }: { type: WorkoutType; className?: string }) {
  const tint = TYPE_TINT[type]
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} style={tint ? { color: tint } : undefined}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TYPE_GLYPH[type] ?? TYPE_GLYPH.easy}
    </svg>
  )
}
```

The `text-accent` classes added by the accent pass stay in place — the inline style overrides them for tinted types, and rest/other fall back to them harmlessly.

- [ ] **Step 4: Run** `npm run test:unit && npm run build && npm run lint` → 141 green / clean / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/components/ui/Icon.tsx apps/coach-web/src/components/ui/Icon.test.tsx
git commit -m "feat(icons): restore intensity tints on coach type icons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: WeekGlanceStrip replaces the strip + pager

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Calendar/WeekGlanceStrip.swift`
- Delete: `apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift` (git rm)
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift`
- Modify: `apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift` (delete the Task-1 back-compat shims)

**Interfaces:**
- Consumes: `GlancePair`/`PairIcon`/`pairs`/`isRestOnly`/`defaultSelection` (Task 1), `TypeBadge.symbol/tint` (Task 2), `store.goToWeek(offset:)`, `selectedDate` state (exists), `unit` (exists in CalendarView).
- Produces: `WeekGlanceStrip(dates:selected:today:pairsFor:restFor:onPick:onSwipeWeek:)`. CalendarView keeps `selectedDate` + the `.onChange(of: store.weekMonday)` default-selection handler (unchanged).

- [ ] **Step 1: Create the view**

```swift
// apps/athlete-ios/RecBuddy/Views/Calendar/WeekGlanceStrip.swift
import SwiftUI

/// The glanceable week: seven day columns, each stacking icon + number pairs
/// for its activities (intensity-tinted type icons; distances in the
/// athlete's unit, time targets as 45'). Past columns fade; today's date is
/// accent; the selected column carries the ring and pilots the headliner.
/// Horizontal drag switches weeks.
struct WeekGlanceStrip: View {
    let dates: [String]                    // Mon..Sun ISO days
    let selected: String
    let today: String
    let pairsFor: (String) -> [GlancePair]
    let restFor: (String) -> Bool
    let onPick: (String) -> Void
    let onSwipeWeek: (Int) -> Void         // ±1

    var body: some View {
        HStack(alignment: .top, spacing: 5) {
            ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                column(date: date, dow: Week.DOW[i].uppercased())
            }
        }
        .gesture(
            DragGesture(minimumDistance: 24)
                .onEnded { g in
                    guard abs(g.translation.width) > 60,
                          abs(g.translation.width) > abs(g.translation.height) else { return }
                    onSwipeWeek(g.translation.width < 0 ? 1 : -1)
                }
        )
    }

    private func column(date: String, dow: String) -> some View {
        let isSelected = date == selected
        let isToday = date == today
        let isPast = date < today                       // ISO strings sort correctly
        let pairs = pairsFor(date)
        return Button { onPick(date) } label: {
            VStack(spacing: 0) {
                Text(dow)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(RB.textFaint)
                Text(String(Int(date.suffix(2)) ?? 0))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(isToday ? RB.accent : isSelected ? .white : RB.textMute)
                    .padding(.top, 1)
                if restFor(date) {
                    Image(systemName: TypeBadge.symbol(for: "rest"))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(RB.textFaint)
                        .padding(.top, 10)
                } else {
                    ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
                        pairView(pair)
                            .padding(.top, 9)   // air BETWEEN pairs; number hugs its icon
                            .opacity(isPast ? 0.45 : 1)
                    }
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity, alignment: .top)
            .background(isSelected ? RB.surface2 : RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1))
            .opacity(isPast ? 0.55 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(dow) \(Week.fmtShortDate(date))")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private func pairView(_ pair: GlancePair) -> some View {
        VStack(spacing: 1) {
            switch pair.icon {
            case .type(let t):
                Image(systemName: TypeBadge.symbol(for: t))
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(TypeBadge.tint(for: t))
            case .sport(let s):
                Image(systemName: s == "ride" ? "bicycle"
                    : s == "swim" ? "figure.pool.swim" : "figure.run")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.green)
            }
            if let text = pair.text {
                Text(text)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(RB.textMute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}
```

- [ ] **Step 2: Rewire `weekSection` in CalendarView.** Replace the DayStrip insertion AND the entire `weekIsEmpty`/skeleton/no-plan/`dayPager` block (keep the nav row HStack and the trailing error label) with:

```swift
            let weekIsEmpty = store.weekDates.allSatisfy {
                (store.workoutsByDate[$0] ?? []).isEmpty && (store.standaloneByDate[$0] ?? []).isEmpty
            }

            if weekIsEmpty && store.phase == .loading {
                ForEach(0..<2, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(RB.surface)
                        .frame(height: 64)
                        .redacted(reason: .placeholder)
                }
            } else {
                WeekGlanceStrip(
                    dates: store.weekDates,
                    selected: selectedDate,
                    today: Week.todayISO(),
                    pairsFor: { date in
                        WeekStripLogic.pairs(workouts: store.workoutsByDate[date] ?? [],
                                             extras: store.standaloneByDate[date] ?? [],
                                             unit: unit)
                    },
                    restFor: { date in
                        WeekStripLogic.isRestOnly(workouts: store.workoutsByDate[date] ?? [],
                                                  extras: store.standaloneByDate[date] ?? [])
                    },
                    onPick: { date in
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) {
                            selectedDate = date
                        }
                    },
                    onSwipeWeek: { offset in
                        Task { await store.goToWeek(offset: offset) }
                    }
                )
                if weekIsEmpty && store.phase == .idle {
                    Text("Your coach hasn't built your plan yet.")
                        .font(.footnote)
                        .foregroundStyle(RB.textMute)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 16)
                }
            }
```

- [ ] **Step 3: Delete the pager machinery** from CalendarView: `pagerID`, `pagerReady`, `snapPager`, `dayPager`, `dayPage(date:)`, `dayEmptyState(label:)`, `weekSentinel(label:)`, `rollover(forward:)`, `rolling`, `weekDayCard(date:workout:)`, `extraWeekRow(date:actual:)`, and `weekStatusIndicator(isDone:)` (its only callers were the deleted cards — verify with grep before removing). `git rm apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift`. Delete the Task-1 back-compat shims (`DayMark`, `marks`, `rolloverLanding`) from `WeekStripLogic.swift`. The `.onChange(of: store.weekMonday)` default-selection handler in `body` STAYS (it now serves chevrons and swipes alike).

- [ ] **Step 4:** `xcodegen generate`, full suite → green (95 baseline shifted by Task 1's test changes). Commit:

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/WeekGlanceStrip.swift apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift
git rm -q apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift 2>/dev/null; git add apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift 2>/dev/null || true
git commit -m "feat(week-glance): icon-column week replaces strip + pager

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Headliner driven by the selected day + Today chip

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift`

**Interfaces:**
- Consumes: `selectedDate`, the existing headliner (`todayStack`, `todayHeroCard`, `todaySliver`, `extraSliver`, `activeTodayId`, `doneTodayKey` auto-advance), `PlanStore.weekMonday` (settable) + `refresh()`.
- Produces: `headlinerSection` (used in `body` where `todayStack` was), `todayChip`, `emptyDayCard`.

- [ ] **Step 1: Repoint the day source.** In CalendarView's computed properties, change ONLY the data source (deck content/styling untouched):

```swift
    // The headliner shows the SELECTED day (today by default) — the week
    // columns pilot it. selectedDate is always inside the displayed week.
    private var todayWorkouts: [Workout] {
        store.workoutsByDate[selectedDate] ?? []
    }

    private var todayExtras: [WorkoutActual] {
        store.standaloneByDate[selectedDate] ?? []
    }
```

(`uncompletedToday`, `orderedToday`, `activeToday`, `todayStackKey`, `doneTodayKey`, `todayStack`, slivers: all untouched — they derive from the two properties above.)

Add a float-state reset so a day switch starts the deck on its natural top card — next to the existing `.onChange(of: doneTodayKey)`:

```swift
        .onChange(of: selectedDate) { _, _ in activeTodayId = nil }
```

- [ ] **Step 2: Chip + empty placeholder.** In `body`, replace the bare `todayStack` line with `headlinerSection`, and add:

```swift
    /// The headliner deck (verbatim), overlaid with the "↩ Today" chip when
    /// the athlete has navigated off today. An empty/rest selected day shows
    /// a quiet placeholder card instead of nothing.
    private var headlinerSection: some View {
        ZStack(alignment: .topTrailing) {
            if activeToday != nil {
                todayStack
            } else {
                emptyDayCard
            }
            if selectedDate != Week.todayISO() {
                todayChip
                    .offset(x: -6, y: -9)
                    .zIndex(10)
            }
        }
    }

    private var todayChip: some View {
        Button {
            let today = Week.todayISO()
            if store.weekDates.contains(today) {
                withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) {
                    selectedDate = today
                }
            } else {
                Task {
                    store.weekMonday = Week.mondayOf(today)
                    await store.refresh()
                    selectedDate = today
                }
            }
        } label: {
            Text("↩ Today")
                .font(.caption2.weight(.bold))
                .foregroundStyle(RB.bg)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(RB.accent)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back to today")
    }

    private var emptyDayCard: some View {
        let rest = WeekStripLogic.isRestOnly(workouts: todayWorkouts, extras: todayExtras)
        return VStack(spacing: 6) {
            Image(systemName: rest ? TypeBadge.symbol(for: "rest") : "calendar")
                .foregroundStyle(RB.textFaint)
            Text(rest ? "Rest day" : "Nothing scheduled")
                .font(.footnote)
                .foregroundStyle(RB.textMute)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(RB.line, lineWidth: 1))
    }
```

NOTE: the old `todayWorkouts` had a "today falls in the displayed week" guard — with `selectedDate` always inside the displayed week, the headliner now correctly shows on EVERY week (that's the design). The widget's `publishTodaySnapshot` lives in PlanStore keyed to actual today and is unaffected.

- [ ] **Step 3:** Full suite green; simulator sanity: tap columns → deck swaps with spring; chip appears off-today, jumps home across weeks; empty/rest placeholder; complete flow auto-advances within the selected day.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(week-glance): headliner deck follows the selected day; Today chip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification + PR

- [ ] **Step 1:** iOS full suite (expect ~99 tests / 15 suites green) and coach-web `test:unit && build && lint` (141 green / clean / 0 errors).
- [ ] **Step 2:** grep-verify no stragglers: `pagerID`, `dayPager`, `DayMark`, `rolloverLanding`, `DayStrip` must have zero hits in `apps/athlete-ios/RecBuddy`.
- [ ] **Step 3:** Push + PR:

```bash
git push -u origin feat/week-glance
gh pr create --base dev --title "feat: week-glance columns + intensity tints return" \
  --body "Glanceable athlete week per docs/superpowers/specs/2026-08-21-week-glance-columns-design.md: seven icon-column days (intensity-tinted icons + per-activity numbers, apostrophe minutes, faded past, moon rest), headliner deck driven by the selected day with a ↩ Today chip, chevrons + swipe week nav. Deletes the day pager. Reverts icon tints app-wide (both apps) — glyphs keep the new cross arrows / recovery heart.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
