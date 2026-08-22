# Week Glance Columns (Athlete Week View v2) — Design

**Date:** 2026-08-21
**Status:** Approved design, pending implementation plan
**Surfaces:** athlete-iOS (replaces the strip + pager from `2026-08-21-athlete-week-strip-design.md`); app-wide intensity-tint revert on BOTH apps. No backend changes.

## Purpose

The day pager duplicated the headliner. The week view becomes a single
glanceable row: seven day columns, each stacking the icons of that day's
activities with their key number, so the shape of the week — and where the
hard and easy days lie — reads without any tap. The headliner becomes THE
day-detail surface, driven by the selected column. Validated through eight
mockup iterations at true iPhone width (393pt).

## Decisions (settled during brainstorming, with mockups)

| Question | Decision |
|---|---|
| Day detail | **The headliner IS the day view** — tapping a column feeds the existing headliner deck with that day's workouts. The deck is retained EXACTLY as shipped: stacked cards with slivers tucked behind, the emphasized DISTANCE and TARGET PACE numerals, To Do/Done states, tab-to-float, tap-to-detail, complete/log flow. Zero content or styling changes — only its data source (selected day, not hardwired today) and the chip overlay |
| Today chip | A lime **"↩ Today"** chip perches on the headliner's top-right corner ONLY when selected ≠ today; tapping selects today AND returns to the current week if the athlete had navigated away |
| Column content | Per activity: **icon + number pair** — number hugs its icon; clear vertical air between pairs so ownership is unambiguous |
| Numbers | Distance-based activities: value + unit in the athlete's setting ("4.0 mi" / "6.4 km"). Time-based (cross, or any workout with no distance but a time target): minutes with apostrophe ("45'"). No target → icon only |
| Completion marks | **None per-activity** (✓ substitution was tried and removed; numbers always show) |
| Past treatment | Past columns fade (55% opacity) and their pairs fade further (45% within) — outstanding work from today onward is the brightest thing in the row |
| Icon color | **Intensity tints return, APP-WIDE on both apps** — orange = effort (intervals/tempo/race), blue = long, green = aerobic (easy/recovery/cross), muted = rest/other. Reverts the accent-only pass; the NEW glyphs stay (cross = circling arrows, recovery = plain heart, logged ride = bicycle) |
| Today marker | Today's **date number renders lime** in its column even when unselected; the selected column keeps the accent ring |
| Rest / empty days | Rest-only day: the rest MOON icon (muted, no number) in the column — same glyph language as everything else; empty day: bare column (DOW + date only). Both selectable — the headliner shows a matching placeholder card |
| Week navigation | **Chevrons + horizontal swipe** across the columns row (drag threshold, no scroll view); after ANY week change selection re-derives via `WeekStripLogic.defaultSelection` (today when visible, else Monday) |
| Extras | Off-plan logged activities appear as pairs after the planned workouts: sport icon (aerobic green) + distance (swims in meters, "1500m") |
| Overflow | Numbers use `minimumScaleFactor(0.7)` + nowrap; columns grow vertically for stacked days (3+ activities) |

## Untouched surfaces (binding)

Everything not explicitly named in this spec is maintained EXACTLY as
shipped: the screen header row, sync badge, pending-confirm banner, the
weekly mileage progress gauge (Run/Cross chips included), the Month/Week
mode toggle, the entire month section, all sheets, and the widget. The only
regions this spec changes are (a) the week section's day rendering (strip +
pager → glance columns) and (b) the headliner's DATA SOURCE + chip overlay.

## Components (athlete iOS)

```
CalendarView
├── headliner (existing todayStack, renamed conceptually to selected-day stack)
│     driven by selectedDate; + TodayChip overlay when selectedDate ≠ today
│     empty/rest selected day → placeholder card ("Rest day" / "Nothing scheduled")
├── weekSection
│     ├── nav row (unchanged chevrons + range)
│     └── WeekGlanceStrip                 ← replaces DayStrip + DayPager entirely
│           7 columns; tap = select; horizontal drag ≥ 60pt = week change
└── (DayPager, sentinels, pagerID/pagerReady/snapPager/rolling,
     dayPage, dayEmptyState, weekDayCard, extraWeekRow: DELETED)
```

- `WeekGlanceStrip(dates:selected:today:pairsFor:restFor:onPick:onSwipeWeek:)`
  — a new view; `pairsFor: (String) -> [GlancePair]` supplies each day's rows.
- `GlancePair` (pure, in `WeekStripLogic.swift`):
  `struct GlancePair: Equatable { let icon: PairIcon; let text: String? }` where
  `PairIcon` is `.type(String)` (workout type → TypeBadge symbol+tint) or
  `.sport(String)` (extra's declaredActivity → sport symbol, aerobic green).
- `WeekStripLogic.pairs(workouts:extras:unit:) -> [GlancePair]` — pure and
  unit-tested: planned non-rest workouts first (dist → "4.0 mi"/"6.4 km" via
  Units; no dist but estMinutes/dur → "45'"; neither → nil text), then extras
  (dist via their sport display; swims in meters "1500m").
- `WeekStripLogic.isRestOnly(workouts:extras:)` — rest-only day flag (the
  strip renders the muted rest moon via `TypeBadge` for such days).
- `DayMark`/`marks(...)` and `rolloverLanding(...)` are DELETED (dots and
  sentinels are gone); `defaultSelection` stays.
- Week swipe: `DragGesture` on the strip — horizontal translation ≥ 60pt and
  |dx| > |dy| → `goToWeek(offset: ±1)`; selection re-derives via the existing
  `.onChange(of: store.weekMonday)` default-selection handler.
- Today chip action: if `store.weekDates` doesn't contain today, first
  `store.weekMonday = Week.mondayOf(Week.todayISO())` + refresh (reuse
  `goToWeek`-style navigation), then `selectedDate = Week.todayISO()`.
- Headliner: `todayStack` and its helpers switch from `Week.todayISO()` to
  `selectedDate` (todayWorkouts → selectedWorkouts, etc.); the existing
  guard "today falls in the displayed week" becomes "selectedDate falls in
  the displayed week" (always true by construction).

## Intensity-tint revert (both apps)

- **iOS `TypeBadge.tint(for:)`** restores the pre-accent map: speed/tempo/race
  → `.orange`; long → `.blue`; rest/other → `.secondary`; everything else →
  `.green`. Symbols keep the current table (cross = `arrow.2.circlepath`,
  recovery = `heart`).
- **coach-web `Icon.tsx`** restores the `TYPE_TINT` inline-style map
  (`#FF9F0A` / `#0A84FF` / `#30D158`, rest/other inherit) applied by default
  inside `TypeIcon` — the `tinted` prop does NOT return; the style simply
  overrides whatever text color class the call site carries, so the
  `text-accent` classes added by the accent pass are left in place as the
  fallback for rest/other. Glyphs unchanged. `SportIcon` stays caller-tinted.
- Tests updated accordingly (iOS TypeBadgeTests tint expectations; coach-web
  Icon.test currentColor assertions become tint assertions).

## Edge cases

- Day with >3 activities: column simply grows (pairs stack; the strip row
  takes the tallest column's height).
- Long numbers ("11.5 mi", "105'"): nowrap + `minimumScaleFactor(0.7)`.
- Week with no plan: strip renders 7 bare columns; the existing
  "Your coach hasn't built your plan yet." message shows below; headliner
  shows the empty placeholder for the selected day.
- Loading: existing skeleton rows replace the strip while the week fetches.
- Widget/TodaySnapshot: unaffected — it stays pinned to actual today.
- Month view: unchanged (dots/legend recolor via the TypeBadge revert only).

## Testing

- Pure + unit-tested: `pairs(workouts:extras:unit:)` (ordering, unit suffix,
  apostrophe minutes, no-target nil, extras' swim meters), `isRestOnly`,
  `defaultSelection` (existing tests stand; rolloverLanding tests deleted).
- iOS TypeBadge tint revert tests; coach-web Icon tint tests.
- Views: build-verified + suite green; interactive feel (tap, swipe week,
  Today chip) device-tested by the user, as with the strip.

## Out of scope

Coach-web layout changes (tint revert only); month view layout; drag-to-move
workouts; per-activity completion marks in columns; animations beyond the
default selection transition.
