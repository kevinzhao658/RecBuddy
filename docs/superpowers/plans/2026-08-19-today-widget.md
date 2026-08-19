# Today Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock-screen + home-screen widgets showing today's PRESCRIBED workouts (extras excluded), fed by an app-written snapshot in the App Group container.

**Architecture:** `TodaySnapshot` (Codable, compiled into app AND widget targets) is written by `PlanStore` on refresh/status changes and cleared at sign-out; a new `RecBuddyWidgets` extension renders it in three families and reloads after midnight. The widget never talks to Supabase.

**Tech Stack:** SwiftUI + WidgetKit (iOS 17), XcodeGen target config, swift-testing.

**Spec:** `docs/superpowers/specs/2026-08-19-today-widget-design.md`

## Global Constraints

- Branch `feat/today-widget` from `origin/dev`; commits end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; merge commits; never delete branches.
- Widget shows PRESCRIBED workouts only — no standalone extras; `rest`-type workouts are excluded from entries (an all-rest/empty day renders the "Rest day" state).
- Never show a stale day's workouts: snapshot `day != today` → "Open RecBuddy" prompt.
- App Group id `group.app.recbuddy.athlete`; widget kind `"TodayWidget"`; widget bundle id `app.recbuddy.athlete.widgets`; team `R2D2PYP37U`.
- iOS 17 API: every widget view sets `.containerBackground(for: .widget)`.
- After ANY file add or project.yml change: `xcodegen generate` in `apps/athlete-ios/` before building. Test/build command (from `apps/athlete-ios/`): `xcodebuild test -project RecBuddy.xcodeproj -scheme "RecBuddy Dev" -destination "platform=iOS Simulator,name=iPhone 17 Pro"` — expect `** TEST SUCCEEDED **`. swift-testing (`@Suite`/`@Test`/`#expect`), TDD where a task has pure logic.
- Do NOT commit `.xcodeproj` or generated `.entitlements` (gitignored). Never `git add .` — the tree may hold unrelated user files.

---

### Task 1: `TodaySnapshot` — shared model + app-side builder (TDD)

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Lib/TodaySnapshot.swift` (compiled into BOTH targets later)
- Create: `apps/athlete-ios/RecBuddy/Lib/TodaySnapshotBuild.swift` (app-only: builds from `[Workout]`)
- Test: `apps/athlete-ios/RecBuddyTests/TodaySnapshotTests.swift`

**Interfaces (later tasks rely on these exact names):**

```swift
struct TodaySnapshot: Codable, Equatable {
    static let appGroup = "group.app.recbuddy.athlete"
    static let key = "todaySnapshot"
    static let widgetKind = "TodayWidget"
    let day: String                      // 'YYYY-MM-DD' local
    let entries: [Entry]                 // prescribed only, to-dos first
    struct Entry: Codable, Equatable, Identifiable {
        let id: String; let title: String; let type: String
        let dist: Double?; let done: Bool
    }
    var nextUp: Entry? { get }           // first not-done
    var doneCount: Int { get }
    var remainingCount: Int { get }      // not-done count
    func isStale(today: String) -> Bool
    func write()                         // app group + WidgetCenter reload
    static func load() -> TodaySnapshot?
    static func clear()
}
extension TodaySnapshot {                // app-only file
    init(day: String, workouts: [Workout])   // filters rest, orders to-dos first
}
```

- [ ] **Step 1: Create the branch**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git fetch origin && git checkout -b feat/today-widget origin/dev
```

- [ ] **Step 2: Write the failing tests** — `TodaySnapshotTests.swift`:

```swift
import Testing
import Foundation
@testable import RecBuddy

@Suite struct TodaySnapshotTests {
    func w(_ id: String, type: String = "easy", dist: Double? = 5, status: String = "planned") -> Workout {
        Workout(id: id, planId: "p", athleteId: "a", date: "2026-08-19", type: type,
                title: "T-\(id)", dist: dist, pace: "9:00/mi", estMinutes: nil,
                dur: nil, note: nil, sets: [], status: status)
    }

    @Test func buildsToDosFirstAndExcludesRest() {
        let snap = TodaySnapshot(day: "2026-08-19",
                                 workouts: [w("done1", status: "done"), w("rest1", type: "rest", dist: nil), w("todo1")])
        #expect(snap.entries.map(\.id) == ["todo1", "done1"])   // to-dos first, rest gone
        #expect(snap.nextUp?.id == "todo1")
        #expect(snap.doneCount == 1)
        #expect(snap.remainingCount == 1)
    }
    @Test func allDoneHasNoNextUp() {
        let snap = TodaySnapshot(day: "2026-08-19", workouts: [w("a", status: "done")])
        #expect(snap.nextUp == nil)
        #expect(snap.remainingCount == 0)
    }
    @Test func stalenessComparesDays() {
        let snap = TodaySnapshot(day: "2026-08-18", workouts: [])
        #expect(snap.isStale(today: "2026-08-19"))
        #expect(!snap.isStale(today: "2026-08-18"))
    }
    @Test func roundTripsThroughJSON() throws {
        let snap = TodaySnapshot(day: "2026-08-19", workouts: [w("a"), w("b", status: "done")])
        let data = try JSONEncoder().encode(snap)
        #expect(try JSONDecoder().decode(TodaySnapshot.self, from: data) == snap)
    }
}
```

- [ ] **Step 3: Run to verify failure** (build/test command from Global Constraints). Expected: compile error — no `TodaySnapshot`.

- [ ] **Step 4: Implement `TodaySnapshot.swift`** (NO app-type imports — this file later compiles into the widget target):

```swift
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Snapshot of TODAY's prescribed workouts, shared with the widget through the
/// App Group container. Extras (off-plan synced activities) and rest days are
/// deliberately excluded — the widget is the day's to-do list, not the log.
struct TodaySnapshot: Codable, Equatable {
    static let appGroup = "group.app.recbuddy.athlete"
    static let key = "todaySnapshot"
    static let widgetKind = "TodayWidget"

    let day: String
    let entries: [Entry]

    struct Entry: Codable, Equatable, Identifiable {
        let id: String
        let title: String
        let type: String
        let dist: Double?
        let done: Bool
    }

    var nextUp: Entry? { entries.first { !$0.done } }
    var doneCount: Int { entries.filter(\.done).count }
    var remainingCount: Int { entries.filter { !$0.done }.count }
    func isStale(today: String) -> Bool { day != today }

    func write() {
        guard let d = UserDefaults(suiteName: Self.appGroup),
              let data = try? JSONEncoder().encode(self) else { return }
        d.set(data, forKey: Self.key)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        #endif
    }
    static func load() -> TodaySnapshot? {
        guard let d = UserDefaults(suiteName: Self.appGroup),
              let data = d.data(forKey: Self.key) else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }
    static func clear() {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.key)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        #endif
    }
}
```

And `TodaySnapshotBuild.swift` (app-only — references `Workout`):

```swift
import Foundation

extension TodaySnapshot {
    /// Prescribed workouts only, to-dos first then completed (headliner order);
    /// rest-type workouts are not to-dos and never appear.
    init(day: String, workouts: [Workout]) {
        let real = workouts.filter { $0.type != "rest" }
        let ordered = real.filter { $0.status != "done" } + real.filter { $0.status == "done" }
        self.init(day: day, entries: ordered.map {
            Entry(id: $0.id, title: $0.title, type: $0.type, dist: $0.dist, done: $0.status == "done")
        })
    }
}
```

- [ ] **Step 5: `xcodegen generate`, run to verify pass.** Expected: `** TEST SUCCEEDED **`, 4 new tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Lib/TodaySnapshot.swift apps/athlete-ios/RecBuddy/Lib/TodaySnapshotBuild.swift apps/athlete-ios/RecBuddyTests/TodaySnapshotTests.swift
git commit -m "feat(ios): TodaySnapshot — app-group model for the today widget

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Widget extension target + provider + views

**Files:**
- Modify: `apps/athlete-ios/project.yml` (widget target, App Group on both targets, embed dependency)
- Create: `apps/athlete-ios/RecBuddyWidgets/TodayWidget.swift`
- Create: `apps/athlete-ios/RecBuddyWidgets/TodayWidgetViews.swift`

**Interfaces:**
- Consumes: `TodaySnapshot` (Task 1) — `RecBuddy/Lib/TodaySnapshot.swift` is compiled into the widget target via its sources list.
- Produces: a building `RecBuddyWidgets` extension embedded in the app.

- [ ] **Step 1: project.yml.** Add App Group to the EXISTING app entitlements block (under `com.apple.developer.healthkit.background-delivery: true`):

```yaml
        com.apple.security.application-groups: [group.app.recbuddy.athlete]
```

Add to the app target's `dependencies:` list:

```yaml
      - target: RecBuddyWidgets
```

Add a new target (sibling of `RecBuddyTests`):

```yaml
  RecBuddyWidgets:
    type: app-extension
    platform: iOS
    sources:
      - RecBuddyWidgets
      - RecBuddy/Lib/TodaySnapshot.swift
    info:
      path: RecBuddyWidgets/Info.plist
      properties:
        CFBundleDisplayName: RecBuddy Widgets
        NSExtension:
          NSExtensionPointIdentifier: com.apple.widgetkit-extension
    entitlements:
      path: RecBuddyWidgets/RecBuddyWidgets.entitlements
      properties:
        com.apple.security.application-groups: [group.app.recbuddy.athlete]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: app.recbuddy.athlete.widgets
        SWIFT_VERSION: "5.10"
        TARGETED_DEVICE_FAMILY: "1"
        DEVELOPMENT_TEAM: R2D2PYP37U
        SKIP_INSTALL: YES
```

- [ ] **Step 2: `TodayWidget.swift`** (bundle + provider):

```swift
import WidgetKit
import SwiftUI

@main
struct RecBuddyWidgets: WidgetBundle {
    var body: some Widget { TodayWidget() }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TodaySnapshot.widgetKind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(red: 0.04, green: 0.047, blue: 0.03) }
        }
        .configurationDisplayName("Today's Plan")
        .description("Your prescribed workouts for the day.")
        .supportedFamilies([.accessoryRectangular, .systemSmall, .systemMedium])
    }
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot?
    let today: String     // local 'YYYY-MM-DD' AT THIS ENTRY's date
}

struct TodayProvider: TimelineProvider {
    private func day(of date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: .sample, today: TodayProvider.sampleDay)
    }
    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: .now, snapshot: TodaySnapshot.load(), today: day(of: .now)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let snap = TodaySnapshot.load()
        // One entry now, one just past local midnight so "today" rolls over and
        // yesterday's list becomes the stale prompt without an app open.
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let entries = [
            TodayEntry(date: now, snapshot: snap, today: day(of: now)),
            TodayEntry(date: midnight.addingTimeInterval(60), snapshot: snap, today: day(of: midnight.addingTimeInterval(60))),
        ]
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    static let sampleDay = "2026-08-19"
}

extension TodaySnapshot {
    /// Gallery preview data.
    static let sample = TodaySnapshot(day: TodayProvider.sampleDay, entries: [
        Entry(id: "1", title: "5 × 800m", type: "speed", dist: 6, done: false),
        Entry(id: "2", title: "Shakeout", type: "easy", dist: 3, done: true),
    ])
}
```

- [ ] **Step 3: `TodayWidgetViews.swift`:**

```swift
import WidgetKit
import SwiftUI

// Widget-local tokens (RB lives in the app target; keep the palette in sync).
private let accent = Color(red: 0.678, green: 1.0, blue: 0.184)   // #ADFF2F
private let mute = Color.white.opacity(0.56)
private let faint = Color.white.opacity(0.30)

/// Type -> SF Symbol, mirroring the app's TypeBadge (duplicated here because
/// TypeBadge depends on app-only theme types).
private func symbol(for type: String) -> String {
    switch type {
    case "easy": return "figure.run"
    case "long": return "arrow.right.to.line"
    case "speed": return "bolt.fill"
    case "tempo": return "gauge.with.needle"
    case "recovery": return "arrow.clockwise.heart"
    case "cross": return "bicycle"
    case "race": return "flag.checkered"
    default: return "figure.run"
    }
}

private func fmtDist(_ d: Double?) -> String {
    guard let d else { return "" }
    return d.truncatingRemainder(dividingBy: 1) == 0 ? " · \(Int(d)) mi" : String(format: " · %.1f mi", d)
}

struct TodayWidgetView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let snap = entry.snapshot, !snap.isStale(today: entry.today) {
                switch family {
                case .accessoryRectangular: LockRect(snap: snap)
                case .systemMedium: HomeCard(snap: snap, maxRows: 4)
                default: HomeSmall(snap: snap)
                }
            } else {
                OpenAppPrompt(family: family)
            }
        }
        .widgetURL(URL(string: "recbuddy://today"))
    }
}

/// Lock screen: next to-do + count. Monochrome-safe (system tints it).
private struct LockRect: View {
    let snap: TodaySnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let next = snap.nextUp {
                Label("\(next.title)\(fmtDist(next.dist))", systemImage: symbol(for: next.type))
                    .font(.headline)
                    .lineLimit(1)
                if snap.remainingCount > 1 {
                    Text("+\(snap.remainingCount - 1) more today").font(.caption2)
                } else if snap.doneCount > 0 {
                    Text("\(snap.doneCount) done").font(.caption2)
                }
            } else if snap.doneCount > 0 {
                Label("All done today", systemImage: "checkmark.circle.fill").font(.headline)
            } else {
                Label("Rest day", systemImage: "moon.zzz").font(.headline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct HomeCard: View {
    let snap: TodaySnapshot
    let maxRows: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TODAY")
                .font(.system(size: 10, weight: .bold))
                .kerning(1.4)
                .foregroundStyle(accent)
            if snap.entries.isEmpty {
                Spacer()
                Label("Rest day", systemImage: "moon.zzz").font(.subheadline).foregroundStyle(mute)
                Spacer()
            } else {
                ForEach(snap.entries.prefix(maxRows)) { e in
                    HStack(spacing: 6) {
                        Image(systemName: symbol(for: e.type)).font(.caption2).foregroundStyle(e.done ? faint : accent)
                        Text(e.title).font(.footnote.weight(.semibold))
                            .foregroundStyle(e.done ? faint : .white)
                            .strikethrough(e.done, color: faint)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text(e.done ? "✓" : fmtDist(e.dist).replacingOccurrences(of: " · ", with: ""))
                            .font(.caption2)
                            .foregroundStyle(e.done ? accent : mute)
                    }
                }
                if snap.entries.count > maxRows {
                    Text("+\(snap.entries.count - maxRows) more").font(.caption2).foregroundStyle(faint)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

private struct HomeSmall: View {
    let snap: TodaySnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TODAY").font(.system(size: 10, weight: .bold)).kerning(1.4).foregroundStyle(accent)
            Spacer(minLength: 0)
            if let next = snap.nextUp {
                Image(systemName: symbol(for: next.type)).font(.title3).foregroundStyle(accent)
                Text(next.title).font(.subheadline.weight(.bold)).foregroundStyle(.white).lineLimit(2)
                Text("\(snap.doneCount) of \(snap.entries.count) done").font(.caption2).foregroundStyle(mute)
            } else if snap.doneCount > 0 {
                Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(accent)
                Text("All done today").font(.subheadline.weight(.bold)).foregroundStyle(.white)
            } else {
                Image(systemName: "moon.zzz").font(.title3).foregroundStyle(mute)
                Text("Rest day").font(.subheadline.weight(.bold)).foregroundStyle(mute)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct OpenAppPrompt: View {
    let family: WidgetFamily
    var body: some View {
        if family == .accessoryRectangular {
            Label("Open RecBuddy for today's plan", systemImage: "arrow.up.forward.app")
                .font(.caption2)
        } else {
            VStack(spacing: 4) {
                Image(systemName: "arrow.up.forward.app").font(.title3).foregroundStyle(mute)
                Text("Open RecBuddy for today's plan")
                    .font(.caption).foregroundStyle(mute).multilineTextAlignment(.center)
            }
        }
    }
}
```

- [ ] **Step 4: `xcodegen generate`, then full test run** (the app scheme builds the embedded extension too). Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit** (Swift files + project.yml ONLY — the generated `RecBuddyWidgets/Info.plist` and `.entitlements` are xcodegen outputs; add `RecBuddyWidgets/*.swift` explicitly):

```bash
git add apps/athlete-ios/project.yml apps/athlete-ios/RecBuddyWidgets/TodayWidget.swift apps/athlete-ios/RecBuddyWidgets/TodayWidgetViews.swift
git commit -m "feat(ios): RecBuddyWidgets extension — lock + home today widgets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If `git status` shows `RecBuddyWidgets/Info.plist` as untracked and it is NOT gitignored, include it in the commit — XcodeGen writes it once from project.yml and the build needs it present; check `git check-ignore` first and report which way it went.)

---

### Task 3: Publish hooks — PlanStore writes, sign-out clears

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Stores/PlanStore.swift`
- Modify: `apps/athlete-ios/RecBuddy/Stores/SessionStore.swift` (signOut)

**Interfaces:**
- Consumes: `TodaySnapshot(day:workouts:)`, `.write()`, `.clear()` (Task 1); `Week.todayISO()`; `PlanStore.workoutsByDate` / `weekDates`.

- [ ] **Step 1: PlanStore.** Add a private method at the end of the class:

```swift
    /// Publish today's prescribed workouts to the widget. Only when the LOADED
    /// week contains today — browsing another week must never clobber the
    /// widget with an empty/wrong day.
    private func publishTodaySnapshot() {
        let today = Week.todayISO()
        guard weekDates.contains(today) else { return }
        TodaySnapshot(day: today, workouts: workoutsByDate[today] ?? []).write()
    }
```

Call it from the two places the day's truth changes:
1. In `refresh()`, immediately after `phase = .idle` (still inside the `do`):
```swift
            publishTodaySnapshot()
```
2. In `setStatus(_:to:)`, after the optimistic local write (the `if let idx, var day = ...` block that reassigns `workoutsByDate[workout.date] = day`), add:
```swift
        publishTodaySnapshot()
```
(`logRun`/`updateRun`/`deleteActual` all end in `refresh()`, so they're covered; the Health sync path ends in `store.refresh()` from CalendarView — covered.)

- [ ] **Step 2: SessionStore.** In `signOut()`, before `state = .signedOut`:

```swift
        TodaySnapshot.clear()   // never show the previous athlete's plan on a widget
```

- [ ] **Step 3: Full test run.** Expected: `** TEST SUCCEEDED **` (no behavior change to existing suites; snapshot write is a no-op in tests where the app-group suite is unavailable).

- [ ] **Step 4: Commit**

```bash
git add apps/athlete-ios/RecBuddy/Stores/PlanStore.swift apps/athlete-ios/RecBuddy/Stores/SessionStore.swift
git commit -m "feat(ios): publish today's plan snapshot to the widget; clear at sign-out

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Final verification + PR

- [ ] **Step 1:** `xcodegen generate` + full test run. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 2:** Simulator smoke note for the report: widgets are verifiable in the simulator (long-press home screen → add "RecBuddy Widgets"); flag this as the reviewer/human check, no automation required.
- [ ] **Step 3: Push + PR**

```bash
cd /Users/kevinzhao/Documents/CodingProject/RecBuddy
git push -u origin feat/today-widget
gh pr create --base dev --head feat/today-widget \
  --title "Today widget: lock-screen + home-screen view of the day's prescribed workouts" \
  --body "Implements docs/superpowers/specs/2026-08-19-today-widget-design.md: RecBuddyWidgets extension (accessoryRectangular + systemSmall/Medium) fed by a TodaySnapshot written to the App Group by PlanStore (refresh/status changes; Health sync covered via refresh) and cleared at sign-out. Prescribed workouts only — extras excluded by design. Stale-day and signed-out states show an open-app prompt; timeline rolls over at midnight.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Deferred (per spec)
Interactive mark-done buttons; Live Activities; extras display; StandBy layouts.
