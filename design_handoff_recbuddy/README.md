# Handoff: RecBuddy — Coach→Client Running Plan Tracker

## Overview
RecBuddy is a coaching platform where running coaches deliver tailored training plans to their athletes. This bundle contains a **complete, interaction-tested prototype** of two surfaces:

- **Athlete app** (`RecBuddy.html`) — iOS-style mobile app. Tabs: **Plan** (calendar) and **Coach** (chat). Includes login + 3-step sign-up.
- **Coach app** (`Coach.html`) — desktop web plan-builder. Roster, week plan grid, workout editor, workout library, per-athlete chat, assistant coaches. Includes login + sign-up.

The goal of this handoff is to **build the backend** and re-implement these designs in a production stack. The prototype is the source of truth for UX, data shapes, and visual design.

---

## About the Design Files
The files in this bundle are **design references created in HTML/React (via in-browser Babel)** — high-fidelity prototypes showing intended look and behavior. They are **not production code to copy directly.**

Architecturally the prototype uses:
- React 18 loaded from CDN, JSX transpiled in-browser by Babel (no build step).
- Components attached to `window` and shared across `<script type="text/babel">` files.
- All state in React `useState` — **no real persistence, no network, no router.**
- All data is mock data defined in `app/core.jsx` and `coach/coach-data.jsx`.
- Auth is a fake boolean (`authed` state); any credentials "work".

**The task:** recreate these designs in a real environment (recommended: Vite + React + TypeScript for web; React Native/Expo if the athlete app should be truly native — it is designed as an iOS phone screen), and build the backend that replaces the mock data and fake auth. Use the design system in `design.md` / `RecBuddy Styleguide.html` as the styling source of truth.

---

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, interactions, and copy. Recreate the UI faithfully using the target codebase's component library, lifting exact tokens from `design.md`. Behavior described below should be wired to real APIs.

---

## Recommended Stack (suggestion, not prescriptive)
- **Frontend:** Vite + React + TypeScript (coach = desktop web; athlete = responsive web or Expo/React Native).
- **Backend / DB:** Postgres. Supabase is the fastest path (Auth + Postgres + Realtime + storage in one) and maps cleanly to the needs below; a custom Node/Express or Next.js API over Postgres works equally well.
- **Auth:** real session auth with a **coach** vs **athlete** role split (the two apps are role-gated). OAuth providers shown in UI: Apple (athlete), Google (coach).
- **Realtime chat:** WebSocket layer (Supabase Realtime / Pusher / socket.io).
- **Run data:** Garmin/Strava OAuth + webhook/polling ingestion (shown as "synced from Garmin").

---

## Data Model (derive your schema from this)
The mock objects already imply the relational model. Suggested tables:

### users
`id, role ('coach'|'athlete'), name, email, password_hash, initials, created_at`
- Athlete extras: `experience_level ('new'|'returning'|'experienced'|'competitive')`, `primary_goal ('fit'|'first-race'|'pr'|'distance')`.
- Coach extras: `title ('Head Coach'|'Assistant Coach'|'Strength Coach'|'Physio')`.

### coach_athlete (roster + coaching team)
`coach_id, athlete_id, relationship ('head'|'assistant'), created_at`
- The **head coach** owns the athlete; **assistant coaches** are added per-athlete and "can edit that athlete's workouts and follow the chat." (See assistant-coach picker in the coach top bar.)

### plans
`id, athlete_id, goal_race, goal_date, goal_distance, goal_time, goal_pace, plan_week, plan_weeks, status ('On track'|'Crushing it'|'Needs check-in')`

### workouts
`id, plan_id (or athlete_id), date (ISO), type, title, dist (mi, nullable), pace (string e.g. '7:30/mi', nullable), est (minutes, nullable — explicit override), dur (minutes, for cross/rest), note (coach note shown to athlete), status ('done'|'today'|'planned'|'missed'|'rest')`
- **type** enum: `easy, long, speed, tempo, recovery, cross, rest` (also `race` exists in the type color map).
- **sets**: ordered list of `[phaseLabel, detail]` pairs, e.g. `['5 × 800m', '@ 3:45 each, 400m jog recovery']`. Store as a child table `workout_sets(workout_id, idx, label, detail)` or JSON.

### workout_actuals (synced run data)
`workout_id, dist, pace, time (elapsed), hr (avg bpm), feel (1–5), source ('garmin'|'strava'|'manual')`

### library_workouts (coach's reusable templates)
`id, coach_id, type, title, dist, pace, sets, note, custom (bool — coach-created vs preset)`

### messages (1:1 athlete↔coach threads)
`id, thread_id, from_user_id, to_user_id, kind ('text'|'runcard'|'adjust'), body, payload (json for runcard/adjust), created_at, read (bool)`
- A thread is per (athlete, coach) pair. Athlete app shows **multiple coaches** (head + assistants/physio) as separate conversations.
- `adjust` messages carry `{from, to, reason}` (plan change cards). `runcard` carries a synced run summary.

### Derived/computed (do NOT store; compute):
- **Est. time per workout** — `est` if set, else `round(dist × paceSeconds / 60)`, else `dur`, else 45 for cross, else 0. (See `estMinutes` in `app/core.jsx`.)
- **Weekly projected time / volume** — sum of `estMinutes` and `dist` across the week (coach top bar "Est. weekly vol." + athlete progress bar).
- **Adherence, streak, weekly mileage, pace trend, HR zones** — aggregates over `workout_actuals` (athlete Metrics view, currently parked — see Notes).

---

## Screens / Views

### ATHLETE APP (`RecBuddy.html`, 402×874 iOS frame)

**1. Login**
- Centered italic wordmark (Rec=lime, Buddy=light), slogan "UNLEASH YOURSELF", email + password (show/hide), lime "LOG IN", divider, "Continue with Apple", "Forgot password?", and "New to RecBuddy? Create an account".

**2. Sign-up (3-step wizard)**
- Top progress bar (3 segments) + back chevron + "n/3".
- Step 1 "Create your account": full name, email, password (≥6). Continue disabled until valid.
- Step 2 "Your running": experience-level cards (radio) + 2×2 primary-goal grid. These feed plan personalization.
- Step 3 "Connect with your coach": invite code (resolves to a coach — shows "Code matches Coach …"), optional Garmin/Strava connect rows. Finish = "Start training" → enters app.

**3. Plan (Calendar tab)**
- Header: "WEEK n OF m", "Your Plan", Garmin sync chip, account avatar button (opens account sheet).
- **Weekly mileage progress bar**: `done / planned mi`, lime fill, "X mi to go this week". Advances as workouts are marked complete.
- **Today hero card**: type, title, distance + target pace, "Details" → opens detail sheet. (No left accent bar.)
- **Month / Week** segmented toggle. Month = dot grid (color = completion status). Week = list rows.
- **Workout detail sheet** (bottom sheet): type chip, date, title, Distance/Target Pace/**Est. Time** stat boxes, **workout structure** (numbered phases), **coach's note**, synced **actuals** (if done), and **Mark as complete** (updates calendar + progress bar).

**4. Coach (Chat tab) — iOS Messages style**
- **Conversation list**: "Messages" title, search field, one row per coach (avatar, name, role, last-message preview, time, unread dot, chevron). Multiple coaches (head + assistants/physio).
- **Search** filters by coach name OR message text, surfaces matching snippet with the term highlighted.
- **Thread**: back chevron header (avatar + name + role + "Active now"), message bubbles (mine=lime/right, coach=surface/left), `runcard` and `adjust` cards inline, composer (type → send → canned reply + typing indicator).

**5. Account sheet**: avatar, name, email; rows Goal & plan / Connected apps / Notifications; **Log out**.

> Note: a **Metrics/Stats** view exists in code (`app/metrics.jsx`: goal-race ring, weekly mileage bars, pace trend, HR zones, adherence/streak, PRs) but is currently **not mounted** in the athlete tab bar. Decide whether to ship it.

### COACH APP (`Coach.html`, 1440×900 desktop, scaled to fit)

**1. Login / Sign-up (split panel)**
- Left brand panel (adapts text by mode), right form. Sign-in: email/password, "Continue with Google", "Athlete? Open the app", "Create a coach account". Sign-up: full name, work email, password, **Coaching title** chips (Head Coach / Assistant Coach / Strength Coach / Physio).

**2. Dashboard**
- **Left sidebar — roster**: "Athletes · n", add-athlete (+), one row per athlete (avatar, name, level · race date, "needs check-in" dot, hover **remove** trash → confirm dialog), "Add athlete" dashed row, and bottom **coach profile** button (opens profile/settings menu with Log out) + "Preview as athlete" link (→ `RecBuddy.html`).
- **Top bar**: athlete avatar, name, status pill, goal race · date · "Week n of m". Right side: **coaching team** avatar cluster (head + assistants + dashed "+") → "Coaching team" popover with **directory search** + add/remove assistants; **Message** button (opens chat drawer); **Duplicate week**.
- **Week summary row**: ‹ Jun 1 – Jun 7 ›, "This week", and right-aligned **Est. weekly vol. (mi)**, **Sessions**, **Completed n/m**.
- **Week plan grid** (7 columns Mon–Sun): each day = workout card or empty slot.
  - Workout card: title, dist · pace, neutral **type icon tucked top-right** (no label), bottom status row (gray dot = planned, green check = done, red = missed) + a **copy icon** (copies workout to clipboard).
  - Color encodes **completion status only** (gray/green/red) — never workout type. Today = bright neutral ring.
  - **Drag** a card to another day to move it. **Click** a day to edit. **Click empty grid space** to close the editor.
  - When a workout is on the clipboard, empty days show a **"Paste …" placeholder** above "Add" (neutral styling). Clipboard persists across athletes.

**3. Right panel — Workout Editor** (when a day is selected)
- Type chips, Title, Distance, Target pace, **Est. time (min)** (auto from dist×pace, overridable; feeds weekly projection), **workout structure** (add/remove phases), **coach's note**. Footer: **Clear day** / **Done**. Empty day shows quick-add type chips.

**4. Right panel — Workout Library** (when nothing selected)
- "WORKOUT LIBRARY" + **New workout** button (create → customize → saves as a CUSTOM template). Preset + custom workout cards are **draggable onto any day** in the grid; presets are editable.

**5. Chat drawer** (per-athlete): slide-in right drawer, 1:1 thread (coach=lime/right, athlete=surface/left), quick replies, composer.

---

## Interactions & Behavior
- **Mark complete** (athlete) → workout status `done`; updates month dots, week rows, weekly mileage bar.
- **Drag-move** (coach grid) → swaps/moves workout between days; status recalculated.
- **Copy/paste** (coach) → app-level clipboard; paste placeholder on empty days, works across athletes.
- **Plan adjustment** → coach edits a workout; in production this should push to the athlete's calendar and optionally drop an `adjust` card in their chat (the prototype shows the card but the two apps don't share live state).
- **Chat** → optimistic append + simulated reply/typing. Replace with realtime + persistence.
- **Search** (athlete chat, coach directory) → client-side substring filter; move to API query at scale.
- **Animations** → 0.18–0.34s, `cubic-bezier(.32,.72,0,1)` for sheets/slides; progress/ring fills animate. (Note: avoid long-lived opacity transitions on conditionally-enabled buttons — one caused a stuck-dim bug, since removed.)

## State Management
Current prototype state (to be replaced by server data + client cache):
- Auth boolean + role; active tab; calendar mode (month/week) + cursor; selected day; `overrides` map (date→status) for completions; coach `clients` (deep-cloned, mutated locally), `clientId`, `dayId`, `clipboard`, `team` per client, chat `convos`, modals (add/remove/profile/team).

---

## Design Tokens (Volt Lime — `THEMES.athletic`)
Full spec in `design.md` + visual reference in `RecBuddy Styleguide.html`. Key values:
- **accent** `#ADFF2F` · **accent2** `#7CCB00` · **onAccent** `#0A0C08`
- **bg** `#0A0C08` · **surface** `#15170F` · **surface2** `#1E2114`
- **text** `#F3FBE8` · **textMute** `rgba(243,251,232,0.56)` · **textFaint** `rgba(243,251,232,0.30)`
- **line** `rgba(243,251,232,0.12)` · **hairline** `rgba(243,251,232,0.07)` · **chip** `rgba(243,251,232,0.08)`
- **completion**: planned=gray(textFaint), done=lime(accent), missed=red `#FF5A52`, today=bright neutral(text)
- **radius** 24 / **radiusSm** 14 / input 10–12 / pill 20
- **shadow** `0 2px 8px rgba(0,0,0,.45), 0 14px 30px rgba(0,0,0,.4)` · accent glow `0 0 22px rgba(173,255,47,.45)` (primary buttons only)
- **Type**: Saira Condensed (display/headings; italic = wordmark only), Space Grotesk (numerals, `tnum`), SF Pro/system (body). Scale + rules in `design.md`.
- **Spacing**: base-4 (4·8·12·16·20·24·32·40).

### Metallic finish (current visual layer)
The athletic theme now uses a **brushed-metal / beveled** treatment (applied via tokens, so it propagates everywhere):
- `surface` / `surface2` are **linear-gradients** (not flat hex) — see `app/core.jsx` (`THEMES.athletic`). A `surfaceFlat` (`#15170F`) is kept for anywhere you need a solid value.
- `cardShadow` is a **bevel stack**: inset top highlight + inset bottom shadow + hairline rim + drop shadows. Reproduce with CSS `box-shadow` (multiple layers, including `inset`).
- The **wordmark + slogans** use solid bright colors (`#C8FF5C` lime / `#FCFFF6` silver) with a layered `text-shadow` bevel — see `.rb-metal-lime` / `.rb-metal-silver` / `.rb-metal-slogan` in `RecBuddy.html` / `Coach.html`. (Do **not** use `background-clip:text` on the italic wordmark — it clips glyphs.)
- To ship a flat alternative, swap the gradient `surface` values back to `surfaceFlat` and simplify `cardShadow`.

## Assets
- No raster assets. Icons are inline SVG (stroke, currentColor) defined in `app/ui.jsx` (`PATHS`). Workout-type glyphs map in `TYPE_ICON`.
- Fonts via Google Fonts (Saira Condensed, Space Grotesk, Newsreader). Self-host in production.
- Logo is **wordmark-only** (no icon mark) — see `design.md` §2.

## Files (in this bundle)
- `RecBuddy.html` — athlete app entry (script load order matters).
- `Coach.html` — coach app entry.
- `app/` — `core.jsx` (themes + mock data + date/time helpers), `ui.jsx` (icons, charts, sheet, tab bar, avatar), `login.jsx`, `signup.jsx`, `calendar.jsx`, `chat.jsx`, `metrics.jsx` (parked), `app.jsx` (athlete shell).
- `coach/` — `coach-data.jsx` (roster, library, assistants), `coach-login.jsx`, `coach-app.jsx` (shell), `plan-grid.jsx`, `editor.jsx`, `coach-chat.jsx`, `coach-modals.jsx` (add-client + confirm).
- `frames/` — `ios-frame.jsx`, `design-canvas.jsx` (prototype scaffolding only — not part of the product).
- `design.md` — written design system. `RecBuddy Styleguide.html` — visual styleguide.

## Suggested build order
1. Auth + roles (replace the fake boolean; wire login/sign-up screens).
2. Postgres schema from the data model above; seed with the mock data in `app/core.jsx` / `coach/coach-data.jsx`.
3. Coach plan CRUD (roster, workouts, library, drag/copy) — the richest surface.
4. Athlete read views (calendar, workout detail, weekly progress) reading the same data.
5. Realtime chat (multi-coach threads + search).
6. Garmin/Strava ingestion for `workout_actuals` (last; its own milestone).
7. (Optional) ship the parked Metrics view.

## Supabase + Vercel
A ready-to-run backend starter lives in **`supabase/`**:
- `01_schema.sql` — tables, enums, triggers (incl. auto-profile-on-signup).
- `02_rls.sql` — row-level security encoding the access rules (athlete sees own data; head + assistant coaches see their athletes; chat visible to the athlete's coaching team).
- `03_seed.sql` — the prototype's mock data as seed.
- `INTEGRATION.md` — Supabase/Vercel wiring: auth + role routing, a screen→query cheatsheet, realtime, and Garmin/Strava ingestion.

Apply the SQL in order (or as migrations), then follow `INTEGRATION.md`.
