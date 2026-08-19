# Today Widget (Lock Screen + Home Screen) — Design

**Date:** 2026-08-19
**Status:** Approved design, pending implementation plan
**Surfaces:** athlete-iOS only (new widget extension target + App Group; no backend changes)

## Purpose

Surface the athlete's current-day PRESCRIBED workouts as glanceable widgets —
a lock-screen rectangle (next to-do) and home-screen small/medium cards (the
day list) — so the day's to-dos are visible without opening the app. Which
widgets to add (both, one, none) is the athlete's choice in the iOS gallery.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Families | **accessoryRectangular (lock) + systemSmall + systemMedium (home)** — one extension, one provider |
| Content | **Prescribed workouts ONLY** — extras (off-plan synced activities) are excluded everywhere in the widget; a big sync day must not flood the card. Extras stay in-app |
| Data | **Snapshot over network** — the app writes `TodaySnapshot` to the App Group container; the widget never talks to Supabase |
| Staleness | Snapshot from a previous day (or signed out) → "Open RecBuddy for today's plan" — never show yesterday's workouts as today's |

## Architecture

```
PlanStore.refresh() / setStatus / logRun / Health-sync completes
  → write TodaySnapshot (JSON) to UserDefaults(suiteName: APP_GROUP)
  → WidgetCenter.shared.reloadTimelines(ofKind: "TodayWidget")

RecBuddyWidgets extension (new target)
  → TimelineProvider reads the snapshot
  → entries: one now + one after next local midnight (so "today" rolls over)
```

- **Targets/entitlements (`project.yml`):** new `RecBuddyWidgets` app-extension
  target (WidgetKit + SwiftUI, bundle id `app.recbuddy.athlete.widgets`, same
  team) and App Group `group.app.recbuddy.athlete` on BOTH app and widget
  targets. `xcodegen generate` after; automatic signing registers the group.
- **`TodaySnapshot`** (Codable, in a file compiled into BOTH targets so the
  logic is unit-tested in `RecBuddyTests`):

```swift
struct TodaySnapshot: Codable, Equatable {
    let day: String                    // 'YYYY-MM-DD' local — staleness check
    let entries: [Entry]               // PRESCRIBED workouts only, stack order
    struct Entry: Codable, Equatable {
        let id: String
        let title: String
        let type: String               // drives the TypeBadge SF Symbol
        let dist: Double?              // miles
        let done: Bool
    }
}
```

Writer filters to plan workouts (no standalone actuals), orders to-dos first
then completed (headliner order). Pure helpers:
`TodaySnapshot.nextUp` (first !done), `remainingCount`, `isStale(today:)`.

## Rendering per family

- **Lock rect (accessoryRectangular):** next to-do's type symbol + title +
  dist, second line "+N more today". All done → "All done today". No workouts →
  "Rest day". Stale/signed-out → "Open RecBuddy". Monochrome-safe (system
  tinting applies on lock screen).
- **systemMedium:** "TODAY · TUE AUG 19" header, up to 4 rows (type symbol,
  title, dist, ✓/○ mark); >4 → "+N more". App tokens (dark card, lime accent).
- **systemSmall:** next to-do prominently + "N of M done".
- **Tap → app** via `widgetURL(URL(string: "recbuddy://today"))` (existing
  scheme; foregrounds to the plan).

## Edge cases

- Day rollover with app unopened: the post-midnight timeline entry re-evaluates
  `isStale` → shows the open-app prompt rather than yesterday's list.
- Sign-out: snapshot cleared (SessionStore sign-out also wipes the group key) →
  open-app prompt.
- Multiple athletes on one device: snapshot is whatever the signed-in athlete
  last loaded — cleared on sign-out, so never another athlete's plan.

## Testing

- Pure + CI-tested in `RecBuddyTests`: snapshot round-trip, prescribed-only
  filtering (extras excluded), stack ordering, `nextUp`/`remainingCount`,
  `isStale` (incl. rollover).
- Widget views: build-verified; rendering checked in the simulator (widgets
  fully work there — no device gate for this feature).

## Out of scope (v1)

Live Activities during a run; interactive widget buttons (mark-done from the
widget); extras in the widget; coach-side widgets; StandBy-specific layouts.
