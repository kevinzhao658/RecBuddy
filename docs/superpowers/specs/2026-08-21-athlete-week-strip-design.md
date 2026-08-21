# Athlete Week Strip (Calendar-Style Week View) — Design

**Date:** 2026-08-21
**Status:** Approved design, pending implementation plan
**Surfaces:** athlete-iOS (CalendarView week section); app-wide icon pass on BOTH apps (athlete-iOS + coach-web). No backend changes.

## Purpose

Replace the athlete's vertical day-by-day week list with a calendar-oriented
view: the days of the week run horizontally as a strip, one day is selected
(today by default), and the selected day's workouts show beneath. Explored and
validated via interactive mockups (option C of three layouts).

## Decisions (settled during brainstorming, with mockups)

| Question | Decision |
|---|---|
| Layout | **Strip + swipeable day pages** — pinned nav row + pinned 7-pill day strip; below, a horizontal pager of day panels with the next day peeking (~12%) |
| Day subheader | **None** — the highlighted pill IS the day indicator ("WEDNESDAY · TODAY" label removed as redundant) |
| Revealing a day | **Tap a pill OR swipe the pager** — tapping a day pill selects it and animates the pager to that day's activities; swiping the pager moves selection and the pill highlight follows |
| Headliner stack | **Keep both** — today's headliner deck stays unchanged above; the strip is the week map (duplication on today is accepted) |
| Glyphs | **Line icons** (not emojis) — emojis lose tinting, drift across iOS versions, and break cross-app unity |
| Icon color | **All accent (lime)** — intensity tints (orange/blue/green) removed; completion state (✓ / fade) is the only secondary signal |
| Cross icon | **Open twin arcs** (cycle metaphor): SF `arrow.2.circlepath` on iOS, matching line drawing on web — replaces the bicycle, which over-emphasized biking now that cross = athlete's choice of run/bike/swim |
| Recovery icon | **Plain heart** — the refresh arrow comes OFF the heart so Recovery can't be confused with the new Cross arrows |
| Icon scope | **App-wide, both apps** — one pass over athlete iOS (headliner, week, month, sheets) and coach-web `TypeIcon`; keeps the "icons unified across apps" rule |
| Week edges | **Chevrons + edge swipe** — chevrons switch weeks; swiping past Sunday rolls to next week's Monday, past Monday to previous week's Sunday |

## Components (athlete iOS — CalendarView week section)

```
weekSection
├── nav row (unchanged): ‹  Aug 17 – Aug 23  ›
├── DayStrip                      new; pinned
│     7 equal pills: DOW + day number + status marks
└── DayPager                      new; replaces the vertical card list
      one page per day, horizontal paging with peek
      ├── workout cards (existing card minus the day column)
      ├── extra-activity rows (existing extraWeekRow, minus day column)
      └── empty state: "Rest day" (rest workout) / "Nothing scheduled"
```

- **Selection state:** `selectedDate: String` lives in CalendarView. Defaults
  to today when the displayed week contains it, else Monday. Re-derived on
  week change (chevrons or edge swipe).
- **DayStrip pill:** weekday label (MON), day number, and under them the
  status marks: a lime ✓ when the day has workouts and ALL are done;
  otherwise one dot per workout — lime for done, grey for planned — capped at
  3 dots. Rest-only or empty days show no marks. Extras count as done dots.
  Selected pill: accent border + brighter number; today's pill keeps its
  existing white-number treatment when not selected.
- **DayPager:** `ScrollView(.horizontal)` with `.scrollTargetBehavior(.viewAligned)`
  and `scrollPosition` bound to the selected date (iOS 17 APIs) — pages are
  ~88% width so the next day peeks. Tapping a pill animates the scroll;
  swiping updates `selectedDate`, which re-highlights the pill.
- **Cards:** reuse the existing week card content (icon tile, title,
  dist/pace — actuals when logged — status chip) without the leading
  day-number column. Extras reuse the extra row minus its day column. All
  existing tap-throughs (workout detail sheet, extra sheet) unchanged.
- **Edge behavior:** swiping past the last page triggers
  `goToWeek(offset: +1)` and selects Monday; past the first page,
  `goToWeek(offset: -1)` and selects Sunday. Chevrons keep their current
  behavior plus the selection default above.
- **Removed:** the vertical `weekDayCard`/`extraWeekRow` list layout and its
  workouts-only day filtering (every day is now reachable via the strip).
- **Unchanged:** headliner stack, mileage gauge, month view, skeleton/error
  states (skeletons render as placeholder pages in the pager).

## Icon pass (both apps)

- **athlete iOS:** every `TypeBadge`/icon tile renders in the accent
  (RB.accent) regardless of type. Glyph changes: cross → `arrow.2.circlepath`,
  recovery → `heart` (no arrow). All other glyphs unchanged.
- **coach-web `Icon.tsx`:** `TYPE_TINT` map and the `tinted` prop are removed;
  `TypeIcon` always renders `currentColor`. Every surface that previously
  showed a tinted type icon adds `text-accent` to its className (surfaces
  that already color the icon via surrounding text, like the editor's type
  chips, stay as they are). Glyph changes: `cross` redrawn as the open twin
  arcs, `recovery` heart loses its renewal arrow. `SPORT_GLYPH.ride` keeps
  the bicycle (a logged ride IS a bike ride — only the cross *type* stops
  being a bicycle).
- Both drawings ship as the same metaphor per the standing icon rule
  (`icons-unified-across-apps`).

## Data

No schema or query changes. The strip and pager read the already-fetched
`workoutsByDate` / `standaloneByDate` / `actualsByWorkout`.

## Edge cases

- Week with no plan at all: strip still renders (7 pills, no marks); pager
  shows the existing "Your coach hasn't built your plan yet." message as a
  single non-paging panel.
- Loading: skeleton cards inside the selected day's panel.
- Error: existing error label below the pager, unchanged.
- Day with >3 workouts: dots cap at 3 (matches month-view icon cap).
- Rapid edge swipes: week loads are async — the pager disables further edge
  rollover until the adjacent week's fetch resolves (uses the existing
  stale-week guard in PlanStore).

## Testing

- Pure + unit-tested (swift-testing): default-selection rule (today vs
  Monday), edge-rollover math (next/prev week + landing day), strip-marks
  derivation (✓ vs dots vs none; extras counted; 3-dot cap).
- UI: build-verified + simulator check (pager sync both directions, peek,
  empty states).
- coach-web: `TypeIcon` tests updated for tint removal + new glyphs;
  full suite/build/lint green.

## Out of scope

Month view layout (unchanged); coach-web calendar layouts; any gauge changes;
animations beyond the pager's native scroll; drag-to-reorder.
