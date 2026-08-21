# Athlete Week Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the athlete's vertical week list with a pinned 7-day strip + swipeable day pager, and switch BOTH apps' workout-type icons to accent-only with a new Cross (open twin arcs) and Recovery (plain heart) glyph.

**Architecture:** A pure `WeekStripLogic` enum carries all testable rules (default selection, edge-rollover landing, per-day status marks). `DayStrip` renders the pills; the pager lives in `CalendarView` using iOS 17 `scrollPosition`/`viewAligned` with sentinel pages for week rollover. The icon pass is mechanical: iOS `TypeBadge` symbol/tint tables and coach-web `Icon.tsx` glyph/tint tables.

**Tech Stack:** SwiftUI (iOS 17, swift-testing), React 18 + TS + Vitest/RTL.

## Global Constraints

- Branch: `feat/week-strip` cut from `dev`; PR into `dev`; normal merge commits; NEVER delete branches; commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Never `git add .` (user files may sit in the tree) — always add explicit paths.
- iOS: after ADDING any file, run `xcodegen generate` from `apps/athlete-ios/` before building. Test command (from `apps/athlete-ios/`): `xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro"`. Baseline: 84 tests / 13 suites green.
- coach-web (from `apps/coach-web/`): `npm run test:unit && npm run build && npm run lint` — 137 tests, 0 lint errors (36 pre-existing warnings are OK; do not add new ones).
- Accent color: iOS `RB.accent`; web Tailwind class `text-accent`. Cross glyph: SF `arrow.2.circlepath` (iOS) / open twin arcs drawing (web). Recovery glyph: SF `heart` (iOS) / heart without renewal arrow (web).
- Spec: `docs/superpowers/specs/2026-08-21-athlete-week-strip-design.md`.

---

### Task 1: WeekStripLogic (pure rules + tests)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift`
- Test: `apps/athlete-ios/RecBuddyTests/WeekStripLogicTests.swift`

**Interfaces:**
- Consumes: `Workout` (`type: String`, `status: String`), `WorkoutActual` from `RecBuddy/Lib/Models.swift`.
- Produces (used by Tasks 4–6):
  - `WeekStripLogic.defaultSelection(weekDates: [String], today: String) -> String`
  - `WeekStripLogic.rolloverLanding(forward: Bool, weekDates: [String]) -> String`
  - `enum DayMark: Equatable { case none; case allDone; case dots([Bool]) }`
  - `WeekStripLogic.marks(workouts: [Workout], extras: [WorkoutActual]) -> DayMark`

- [ ] **Step 1: Write the failing tests**

```swift
// apps/athlete-ios/RecBuddyTests/WeekStripLogicTests.swift
import Testing
import Foundation
@testable import RecBuddy

@Suite struct WeekStripLogicTests {
    let week = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
                "2026-08-21", "2026-08-22", "2026-08-23"]

    func workout(_ id: String, type: String = "easy", status: String = "planned") -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "W", dist: 5, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: status)
    }
    func extra(_ id: String) throws -> WorkoutActual {
        let json = """
        {"id":"\(id)","workout_id":null,"athlete_id":"a","dist":3.0,"pace":null,
         "time":"30:00","hr":null,"feel":null,"note":null,"source":"manual",
         "source_id":null,"recorded_at":"2026-08-19T16:00:00+00:00","activity":"ride"}
        """.data(using: .utf8)!
        return try JSONDecoder().decode(WorkoutActual.self, from: json)
    }

    @Test func selectsTodayWhenWeekContainsIt() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-08-19") == "2026-08-19")
    }
    @Test func selectsMondayWhenTodayOutsideWeek() {
        #expect(WeekStripLogic.defaultSelection(weekDates: week, today: "2026-09-01") == "2026-08-17")
    }
    @Test func rolloverLandsOnMondayForwardSundayBackward() {
        #expect(WeekStripLogic.rolloverLanding(forward: true, weekDates: week) == "2026-08-17")
        #expect(WeekStripLogic.rolloverLanding(forward: false, weekDates: week) == "2026-08-23")
    }
    @Test func emptyAndRestOnlyDaysHaveNoMarks() {
        #expect(WeekStripLogic.marks(workouts: [], extras: []) == .none)
        #expect(WeekStripLogic.marks(workouts: [workout("r", type: "rest")], extras: []) == .none)
    }
    @Test func allDoneCollapsesToCheck() throws {
        #expect(WeekStripLogic.marks(workouts: [workout("w1", status: "done")], extras: []) == .allDone)
        // Extras always count as done — an extras-only day is all-done too.
        #expect(try WeekStripLogic.marks(workouts: [], extras: [extra("x1")]) == .allDone)
    }
    @Test func mixedDaysShowPerWorkoutDots() throws {
        let m = try WeekStripLogic.marks(
            workouts: [workout("w1", status: "done"), workout("w2")], extras: [extra("x1")])
        #expect(m == .dots([true, false, true]))
    }
    @Test func dotsCapAtThree() {
        let ws = [workout("a"), workout("b"), workout("c"), workout("d", status: "done")]
        #expect(WeekStripLogic.marks(workouts: ws, extras: []) == .dots([false, false, false]))
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run (from `apps/athlete-ios/`): `xcodegen generate && xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro"`
Expected: BUILD FAILED — `cannot find 'WeekStripLogic' in scope` (the test file exists, the impl doesn't).

- [ ] **Step 3: Implement**

```swift
// apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift
import Foundation

/// Which status marks a day-strip pill shows under its date.
enum DayMark: Equatable {
    case none            // empty or rest-only day
    case allDone         // lime ✓ — everything logged
    case dots([Bool])    // one dot per unit, true = done; capped at 3
}

/// Pure rules for the athlete week strip — selection defaults, edge-rollover
/// landing day, and per-day status marks. No SwiftUI, fully unit-tested.
enum WeekStripLogic {
    /// Today when the displayed week contains it; else Monday.
    static func defaultSelection(weekDates: [String], today: String) -> String {
        weekDates.contains(today) ? today : (weekDates.first ?? today)
    }

    /// Swiping past Sunday lands on next week's Monday; past Monday on the
    /// previous week's Sunday. Called with the NEW week's dates.
    static func rolloverLanding(forward: Bool, weekDates: [String]) -> String {
        (forward ? weekDates.first : weekDates.last) ?? ""
    }

    /// ✓ when every unit is done; otherwise one dot per unit (done = lime),
    /// capped at 3. Rest workouts don't count; extras always count as done.
    static func marks(workouts: [Workout], extras: [WorkoutActual]) -> DayMark {
        let active = workouts.filter { $0.type != "rest" && $0.status != "rest" }
        let flags = active.map { $0.status == "done" } + extras.map { _ in true }
        if flags.isEmpty { return .none }
        if !flags.contains(false) { return .allDone }
        return .dots(Array(flags.prefix(3)))
    }
}
```

- [ ] **Step 4: Run to verify pass** — same command; expected: all suites pass (84 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Lib/WeekStripLogic.swift apps/athlete-ios/RecBuddyTests/WeekStripLogicTests.swift
git commit -m "feat(week-strip): pure selection/rollover/marks rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: iOS icon pass — accent-only TypeBadge, new Cross/Recovery symbols

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Components/TypeBadge.swift`
- Test: `apps/athlete-ios/RecBuddyTests/TypeBadgeTests.swift` (create)

**Interfaces:**
- Produces: `TypeBadge.symbol(for:)` returns `"arrow.2.circlepath"` for `"cross"`, `"heart"` for `"recovery"`; `TypeBadge.tint(for:)` returns `RB.accent` for every type. All existing call sites (`WorkoutDetailSheet`, `CalendarView` month legend/dots, `MessageRow`, `ConfirmActivitySheet`, `MultiWorkoutDaySheet`) keep compiling unchanged — the API is identical.

- [ ] **Step 1: Write the failing test**

```swift
// apps/athlete-ios/RecBuddyTests/TypeBadgeTests.swift
import Testing
import SwiftUI
@testable import RecBuddy

@Suite struct TypeBadgeTests {
    @Test func crossIsCirclingArrowsNotABicycle() {
        #expect(TypeBadge.symbol(for: "cross") == "arrow.2.circlepath")
    }
    @Test func recoveryIsAPlainHeart() {
        #expect(TypeBadge.symbol(for: "recovery") == "heart")
    }
    @Test func everyTypeTintsAccent() {
        for t in ["easy", "long", "speed", "tempo", "recovery", "cross", "rest", "race", "other"] {
            #expect(TypeBadge.tint(for: t) == RB.accent)
        }
    }
    @Test func unknownTypeFallsBackToRunner() {
        #expect(TypeBadge.symbol(for: "mystery") == "figure.run")
    }
}
```

- [ ] **Step 2: Run to verify failure** — `xcodegen generate` then the standard test command. Expected: FAIL (`cross` still `"bicycle"`, tints still orange/blue/green).

- [ ] **Step 3: Implement** — replace the two tables in `TypeBadge.swift`:

```swift
    static func symbol(for type: String) -> String {
        switch type {
        case "easy": return "figure.run"
        case "long": return "arrow.right.to.line"
        case "speed": return "bolt.fill"
        case "tempo": return "gauge.with.needle"
        case "recovery": return "heart"                 // plain heart — the refresh arrow now belongs to Cross
        case "cross": return "arrow.2.circlepath"       // cycle-between-disciplines; NOT a bicycle
        case "rest": return "moon.zzz"
        case "race": return "flag.checkered"
        case "other": return "ellipsis.circle"
        default: return "figure.run"
        }
    }
    /// One voice: every type icon renders in the accent. Intensity is carried
    /// by the plan, not the icon; kept as a function so call sites are stable.
    static func tint(for type: String) -> Color { RB.accent }
```

(Silence the unused-parameter warning with `_ = type` only if the compiler flags it; Swift does not warn here.)

- [ ] **Step 4: Run to verify pass** — standard test command; all green.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Components/TypeBadge.swift apps/athlete-ios/RecBuddyTests/TypeBadgeTests.swift
git commit -m "feat(icons): iOS type icons go accent-only; cross = circling arrows, recovery = heart

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: coach-web icon pass — accent-only TypeIcon, new glyphs

**Files:**
- Modify: `apps/coach-web/src/components/ui/Icon.tsx`
- Modify (add `text-accent`): `apps/coach-web/src/features/chat/MessageItem.tsx` (2 sites), `apps/coach-web/src/features/plan-grid/WorkoutSliver.tsx`, `DragGhost.tsx`, `MonthDayModal.tsx`, `DayCard.tsx`, `MonthGrid.tsx` (DayCell icon row), `WorkoutKey.tsx`, `apps/coach-web/src/features/library/WorkoutLibrary.tsx`
- Leave alone: `apps/coach-web/src/components/ui/WorkoutFields.tsx` (type chips already color via surrounding text)
- Test: `apps/coach-web/src/components/ui/Icon.test.tsx` (create)

**Interfaces:**
- Produces: `TypeIcon({ type, className })` — the `tinted` prop is REMOVED; the svg has no inline `style` color and inherits `currentColor`. `TYPE_GLYPH.cross` = open twin arcs; `TYPE_GLYPH.recovery` = heart without the renewal arrow. `SPORT_GLYPH.ride` KEEPS the bicycle (a logged ride is a bike ride); `SPORT_GLYPH.run` keeps referencing `TYPE_GLYPH.easy`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/coach-web/src/components/ui/Icon.test.tsx
import { render } from '@testing-library/react'
import { TypeIcon, SportIcon } from './Icon'

test('TypeIcon inherits currentColor — no baked-in tint style', () => {
  const { container } = render(<TypeIcon type="tempo" className="text-accent" />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('style')).toBeNull()
  expect(svg.getAttribute('class')).toContain('text-accent')
})

test('cross renders circling arrows (two arcs + two arrowheads), not a bicycle', () => {
  const { container } = render(<TypeIcon type="cross" />)
  expect(container.querySelectorAll('circle')).toHaveLength(0)      // bicycle had two wheel circles
  expect(container.querySelectorAll('polyline')).toHaveLength(2)    // the two arrowheads
})

test('recovery heart carries no renewal arrow', () => {
  const { container } = render(<TypeIcon type="recovery" />)
  expect(container.querySelectorAll('path')).toHaveLength(1)        // heart only (old icon had 2 paths)
})

test('a logged ride still shows a bicycle', () => {
  const { container } = render(<SportIcon sport="ride" />)
  expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 2: Run to verify failure** — `npm run test:unit` from `apps/coach-web/`. Expected: FAIL (tint style present, cross has circles).

- [ ] **Step 3: Implement in `Icon.tsx`:**

Replace the `cross` and `recovery` entries of `TYPE_GLYPH`:

```tsx
  // heart — recovery (the refresh arrow now belongs to Cross)
  recovery: (
    <path d="M12 20.5s-6.5-4.2-6.5-9a3.7 3.7 0 016.5-2.4 3.7 3.7 0 016.5 2.4c0 4.8-6.5 9-6.5 9z" />
  ),
  // arrow.2.circlepath — cross-training: two arcs chasing each other
  cross: (
    <>
      <path d="M5.2 13.5a7 7 0 0 1 11.6-6.9" />
      <polyline points="16.6 2.9 16.9 6.7 13.1 7" />
      <path d="M18.8 10.5a7 7 0 0 1-11.6 6.9" />
      <polyline points="7.4 21.1 7.1 17.3 10.9 17" />
    </>
  ),
```

CRITICAL: `SPORT_GLYPH.ride` currently references `TYPE_GLYPH.cross` — with cross redrawn as arrows, a logged ride would lose its bicycle. Give ride its own drawing (the bicycle that used to live in `TYPE_GLYPH.cross`):

```tsx
  // bicycle — a logged ride IS a bike ride; only the cross TYPE stopped being one
  ride: (
    <>
      <circle cx="6" cy="16.5" r="3.2" />
      <circle cx="18" cy="16.5" r="3.2" />
      <path d="M6 16.5l3.6-6.3h4.9l3.5 6.3M9.6 10.2L8.2 7.6h-2M13 7.2h2.6" />
    </>
  ),
```

(`SPORT_GLYPH.run` keeps referencing `TYPE_GLYPH.easy` — the runner is unchanged.)

Delete the `TYPE_TINT` const and its doc comment, and change `TypeIcon` to:

```tsx
export function TypeIcon({ type, className = '' }: { type: WorkoutType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TYPE_GLYPH[type] ?? TYPE_GLYPH.easy}
    </svg>
  )
}
```

Update the file-top doc comment: icons render in the caller's text color; every surface passes `text-accent` (one voice, matching athlete iOS).

Then in each listed call-site file, make the type icon accent — replace the icon's color class (`text-text-mute`) with `text-accent`, or add `text-accent` where no color class exists. The exact edits:

| File | Old fragment | New fragment |
|---|---|---|
| MessageItem.tsx (both) | `className="shrink-0 text-text-mute"` / `className="mt-0.5 shrink-0 text-text-mute"` on `<TypeIcon` | `className="shrink-0 text-accent"` / `className="mt-0.5 shrink-0 text-accent"` |
| WorkoutSliver.tsx | `className="shrink-0"` | `className="shrink-0 text-accent"` |
| DragGhost.tsx | `className="shrink-0 text-text-mute"` | `className="shrink-0 text-accent"` |
| MonthDayModal.tsx | `className="shrink-0"` | `className="shrink-0 text-accent"` |
| DayCard.tsx | `className="mt-0.5 shrink-0 text-text-mute"` | `className="mt-0.5 shrink-0 text-accent"` |
| MonthGrid.tsx (DayCell) | `className="h-3.5 w-3.5"` | `className="h-3.5 w-3.5 text-accent"` |
| WorkoutKey.tsx | `className="h-3.5 w-3.5 text-text-mute"` | `className="h-3.5 w-3.5 text-accent"` |
| WorkoutLibrary.tsx | `className="mt-0.5 shrink-0 text-text-mute"` | `className="mt-0.5 shrink-0 text-accent"` |

WorkoutFields.tsx keeps `className="h-3.5 w-3.5"` (chips color by selection state) — but the removed `tinted` prop means no other change is needed there.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:unit && npm run build && npm run lint`
Expected: 141 tests green (137 + 4), build clean, lint 0 errors / 36 warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/coach-web/src/components/ui/Icon.tsx apps/coach-web/src/components/ui/Icon.test.tsx \
  apps/coach-web/src/features/chat/MessageItem.tsx apps/coach-web/src/features/plan-grid/WorkoutSliver.tsx \
  apps/coach-web/src/features/plan-grid/DragGhost.tsx apps/coach-web/src/features/plan-grid/MonthDayModal.tsx \
  apps/coach-web/src/features/plan-grid/DayCard.tsx apps/coach-web/src/features/plan-grid/MonthGrid.tsx \
  apps/coach-web/src/features/plan-grid/WorkoutKey.tsx apps/coach-web/src/features/library/WorkoutLibrary.tsx
git commit -m "feat(icons): coach type icons go accent-only; cross = circling arcs, recovery = heart

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: DayStrip component + selection state

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift` (weekSection; add `@State private var selectedDate`)

**Interfaces:**
- Consumes: `WeekStripLogic.marks/defaultSelection` (Task 1), `PlanStore.weekDates/workoutsByDate/standaloneByDate`, `Week.DOW`, `Week.todayISO()`, `RB` theme.
- Produces: `DayStrip(dates:selected:marksFor:onPick:)` — `selected: String`, `marksFor: (String) -> DayMark`, `onPick: (String) -> Void`. CalendarView owns `@State private var selectedDate: String = Week.todayISO()` (Tasks 5–6 bind the pager to it).

- [ ] **Step 1: Implement DayStrip** (view-only; verified by build + Task 1's logic tests)

```swift
// apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift
import SwiftUI

/// The horizontal 7-day strip: weekday + date pills with status marks under
/// the number (✓ all done, dots otherwise — lime done / grey planned).
/// Tapping a pill reveals that day's activities in the pager below.
struct DayStrip: View {
    let dates: [String]                    // the week's 7 ISO days, Mon..Sun
    let selected: String
    let marksFor: (String) -> DayMark
    let onPick: (String) -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(dates.enumerated()), id: \.element) { i, date in
                pill(date: date, dow: Week.DOW[i].uppercased())
            }
        }
    }

    private func pill(date: String, dow: String) -> some View {
        let isSelected = date == selected
        let isToday = date == Week.todayISO()
        return Button { onPick(date) } label: {
            VStack(spacing: 2) {
                Text(dow)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(RB.textFaint)
                Text(String(Int(date.suffix(2)) ?? 0))
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(isSelected || isToday ? .white : RB.textMute)
                markRow(marksFor(date))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(isSelected ? RB.surface2 : RB.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? RB.accent : RB.line, lineWidth: isSelected ? 1.5 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(dow) \(date)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private func markRow(_ mark: DayMark) -> some View {
        switch mark {
        case .none:
            Color.clear.frame(height: 4)
        case .allDone:
            Image(systemName: "checkmark")
                .font(.system(size: 6, weight: .bold))
                .foregroundStyle(RB.accent)
                .frame(height: 4)
        case .dots(let flags):
            HStack(spacing: 2) {
                ForEach(Array(flags.enumerated()), id: \.offset) { _, done in
                    Circle().fill(done ? RB.accent : RB.textFaint)
                        .frame(width: 4, height: 4)
                }
            }
            .frame(height: 4)
        }
    }
}
```

- [ ] **Step 2: Wire into CalendarView.** Add state next to `showCrossMileage`:

```swift
    // The week strip's selected day (today when the week contains it).
    @State private var selectedDate: String = Week.todayISO()
```

In `weekSection`, insert the strip directly under the nav row `HStack` (before the `workoutDays` block):

```swift
            DayStrip(dates: store.weekDates, selected: selectedDate,
                     marksFor: { date in
                         WeekStripLogic.marks(workouts: store.workoutsByDate[date] ?? [],
                                              extras: store.standaloneByDate[date] ?? [])
                     },
                     onPick: { date in
                         withAnimation(.easeInOut(duration: 0.2)) { selectedDate = date }
                     })
```

And re-derive the default whenever the displayed week changes — add to the view's modifiers (next to the existing `.task`/`.onChange` chain in `body`):

```swift
        .onChange(of: store.weekMonday) { _, _ in
            selectedDate = WeekStripLogic.defaultSelection(weekDates: store.weekDates,
                                                           today: Week.todayISO())
        }
```

The old vertical list stays for THIS task (Task 5 replaces it) so the app remains fully usable at every commit.

- [ ] **Step 3: Build + full suite** — `xcodegen generate` (new file!), standard test command. Expected: TEST SUCCEEDED.

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/DayStrip.swift apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(week-strip): pinned 7-day strip with status marks + selection state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: DayPager — swipeable day panels replace the vertical list

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift` (weekSection body; `weekDayCard`; `extraWeekRow`)

**Interfaces:**
- Consumes: `selectedDate` (Task 4), existing `weekDayCard`/`extraWeekRow` internals, `selected`/`selectedExtra` sheet bindings.
- Produces: `@State private var pagerID: String?` bound to the scroll position; `dayPage(date:) -> some View`. Task 6 adds sentinel pages around the `ForEach`.

- [ ] **Step 1: Slim the cards.** In `weekDayCard(date:workout:)`, delete the leading "Day column" `VStack` (the `dow`/`dayNum` block and its `.frame(width: 40)`) and the now-unused `dowIndex`/`dow`/`dayNum` lets; keep everything else (icon tile, title, dist/pace with actuals, status, today ring). In `extraWeekRow(date:actual:)`, delete its leading day `VStack(spacing: 2)` block and the `dowIndex` let; keep the icon/title/metrics/status. (The `date:` parameter stays in both signatures — callers still pass it.)

- [ ] **Step 2: Replace the list with the pager.** In `weekSection`, replace everything from `// Day cards — only days with workouts` down through the `ForEach(workoutDays …)` block (keep the trailing error label) with:

```swift
            let weekIsEmpty = store.weekDates.allSatisfy {
                (store.workoutsByDate[$0] ?? []).isEmpty && (store.standaloneByDate[$0] ?? []).isEmpty
            }

            if weekIsEmpty && store.phase == .loading {
                VStack(spacing: 10) {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 16)
                            .fill(RB.surface)
                            .frame(height: 64)
                            .redacted(reason: .placeholder)
                    }
                }
            } else if weekIsEmpty && store.phase == .idle {
                Text("Your coach hasn't built your plan yet.")
                    .font(.footnote)
                    .foregroundStyle(RB.textMute)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                dayPager
            }
```

- [ ] **Step 3: Add the pager + page views** (new members near `weekSection`):

```swift
    /// One page per day; ~88% width so the next day peeks. Strip and pager
    /// stay in sync both ways: tap a pill → animate here; swipe → pill follows.
    @State private var pagerID: String?

    private var dayPager: some View {
        ScrollView(.horizontal) {
            LazyHStack(alignment: .top, spacing: 10) {
                ForEach(store.weekDates, id: \.self) { date in
                    dayPage(date: date)
                        .id(date)
                        .containerRelativeFrame(.horizontal) { len, _ in len * 0.88 }
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $pagerID)
        .onAppear { pagerID = selectedDate }
        .onChange(of: selectedDate) { _, new in
            guard pagerID != new else { return }
            withAnimation(.easeInOut(duration: 0.25)) { pagerID = new }
        }
        .onChange(of: pagerID) { _, new in
            guard let new, new != selectedDate, store.weekDates.contains(new) else { return }
            withAnimation(.easeInOut(duration: 0.15)) { selectedDate = new }
        }
    }

    @ViewBuilder
    private func dayPage(date: String) -> some View {
        let workouts = store.workoutsByDate[date] ?? []
        let extras = store.standaloneByDate[date] ?? []
        VStack(spacing: 8) {
            if workouts.isEmpty && extras.isEmpty {
                dayEmptyState(label: "Nothing scheduled")
            } else if workouts.allSatisfy({ $0.type == "rest" || $0.status == "rest" }) && extras.isEmpty {
                dayEmptyState(label: "Rest day")
            } else {
                ForEach(workouts.filter { $0.type != "rest" && $0.status != "rest" }, id: \.id) { w in
                    weekDayCard(date: date, workout: w)
                }
                ForEach(extras, id: \.id) { a in
                    extraWeekRow(date: date, actual: a)
                }
            }
        }
    }

    private func dayEmptyState(label: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: label == "Rest day" ? "moon.zzz" : "calendar")
                .foregroundStyle(RB.textFaint)
            Text(label).font(.footnote).foregroundStyle(RB.textMute)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(RB.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(RB.line, lineWidth: 1))
    }
```

- [ ] **Step 4: Build + full suite + simulator sanity.** Standard test command → TEST SUCCEEDED. In the simulator (or preview): tap pills — pager animates; swipe — pill highlight follows; workout tap still opens the detail sheet; extra tap opens the extra sheet; rest/empty days render their states.

- [ ] **Step 5: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(week-strip): swipeable day pager replaces the vertical week list

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Edge rollover — swiping past the week's ends changes weeks

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift` (dayPager, chevron handlers)

**Interfaces:**
- Consumes: `WeekStripLogic.rolloverLanding/defaultSelection`, `PlanStore.goToWeek(offset:)` (async, has its own stale-week guard), `pagerID`/`selectedDate` (Tasks 4–5).
- Produces: sentinel page ids `"prev"`/`"next"`; `@State private var rolling = false`.

- [ ] **Step 1: Add sentinels + rollover.** In `dayPager`'s `LazyHStack`, wrap the `ForEach` with sentinel pages:

```swift
                weekSentinel(label: "‹ Last week").id("prev")
                    .containerRelativeFrame(.horizontal) { len, _ in len * 0.4 }
                ForEach(store.weekDates, id: \.self) { date in
                    dayPage(date: date)
                        .id(date)
                        .containerRelativeFrame(.horizontal) { len, _ in len * 0.88 }
                }
                weekSentinel(label: "Next week ›").id("next")
                    .containerRelativeFrame(.horizontal) { len, _ in len * 0.4 }
```

Extend the `onChange(of: pagerID)` handler — replace it with:

```swift
        .onChange(of: pagerID) { _, new in
            guard let new else { return }
            if new == "next" { rollover(forward: true); return }
            if new == "prev" { rollover(forward: false); return }
            guard new != selectedDate, store.weekDates.contains(new) else { return }
            withAnimation(.easeInOut(duration: 0.15)) { selectedDate = new }
        }
```

Add the members:

```swift
    /// Debounces edge rollovers — a second fling while a week loads is ignored.
    @State private var rolling = false

    private func weekSentinel(label: String) -> some View {
        VStack {
            if rolling { ProgressView().tint(RB.accent) }
            else { Text(label).font(.footnote.weight(.semibold)).foregroundStyle(RB.textMute) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }

    private func rollover(forward: Bool) {
        guard !rolling else { return }
        rolling = true
        Task {
            await store.goToWeek(offset: forward ? 1 : -1)
            let landing = WeekStripLogic.rolloverLanding(forward: forward, weekDates: store.weekDates)
            selectedDate = landing
            pagerID = landing        // snap the new week's pager to the landing page
            rolling = false
        }
    }
```

NOTE: the Task 4 `.onChange(of: store.weekMonday)` default-selection handler fires on rollover too — `rollover` sets `selectedDate` AFTER `goToWeek` returns, so the rollover landing wins (both run on the main actor, and `goToWeek`'s refresh completes before the next line). Chevrons keep the plain default: they only trigger the `.onChange`, landing on today-or-Monday.

- [ ] **Step 2: Build + full suite + simulator sanity.** Standard test command → TEST SUCCEEDED. Simulator: fling past Sunday → next week loads, Monday selected; past Monday → previous week, Sunday selected; chevrons land on today (current week) or Monday; double-fling during load doesn't double-jump.

- [ ] **Step 3: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift
git commit -m "feat(week-strip): edge swipes roll into adjacent weeks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification + PR

**Files:** none (verification only)

- [ ] **Step 1: iOS full suite** — standard command from `apps/athlete-ios/`. Expected: ~95 tests / 15 suites, TEST SUCCEEDED.
- [ ] **Step 2: coach-web full suite** — `npm run test:unit && npm run build && npm run lint` from `apps/coach-web/`. Expected: 141 tests, build clean, 0 lint errors / 36 warnings.
- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/week-strip
gh pr create --base dev --title "feat: athlete week strip + app-wide accent icons" \
  --body "Calendar-style athlete week view (pinned 7-day strip + swipeable day pager, tap or swipe to reveal a day, edge swipes roll weeks) per docs/superpowers/specs/2026-08-21-athlete-week-strip-design.md. App-wide icon pass: accent-only type icons on both apps; cross = circling arrows; recovery = plain heart.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
