# RecBuddy — Sub-project B: Coach Web Plan-Builder (Design Spec)

**Date:** 2026-06-15
**Status:** Approved (design); ready for implementation planning
**Depends on:** Sub-project A (Backend Foundation) — complete.

---

## 0. Context

RecBuddy is a coach→athlete running-plan platform (see root `README.md`). Sub-project A shipped the
Supabase backend (schema, RLS, auth, invites, RPCs, seed, tests). This sub-project builds the
**coach-facing desktop web app** — where coaches build and manage custom training plans.

**Locked decisions (from brainstorming):**
- **App:** Vite + React + TypeScript SPA at `apps/coach-web/`.
- **Privileged server action:** one Supabase **Edge Function** for coach signup.
- **In-app stack:** TanStack Query (server state), React Router, Tailwind v4 (Volt Lime tokens as
  `@theme` CSS variables), dnd-kit (drag), Vitest + React Testing Library (tests).
- **Scope:** full coach surface **minus chat** (chat = sub-project D). Garmin/metrics out (E/F).
- **Invite UX:** pending invite rows shown in the roster until redeemed.
- **Repo:** two independent frontends over one shared backend; reorg into `apps/` + consolidated
  `supabase/` as the first step of B.

The design handoff prototype (`design_handoff_recbuddy/Coach.html` + `coach/*.jsx`) is the source of
truth for UX, data shapes, and visual design; `design.md` is the styling source of truth.

---

## 1. Scope & boundaries

**In scope**
- Repo reorganization: backend tooling under `supabase/`, apps under `apps/`.
- Coach **auth**: login + sign-up (sign-up via the Edge Function), coach-only route gating.
- **Roster**: list real athletes; "Add athlete" → generate invite code; **pending invite rows**
  (revocable) until redeemed; remove athlete (confirm); coach profile menu (log out, "Preview as
  athlete").
- **Week plan grid** (Mon–Sun): workout cards, drag-move between days, click-to-edit, copy/paste
  with paste placeholder, completion-status colors only, "Duplicate week".
- **Workout editor** (right panel when a day is selected): type, title, distance, target pace,
  est-time (auto from dist×pace, overridable), workout structure phases, coach note; Clear day / Done.
- **Workout library** (right panel when nothing selected): preset + custom templates, "New
  workout", drag onto any grid day; presets editable.
- **Coaching-team popover**: directory search of other coaches, add/remove assistants (head-only).
- Three backend additions (in `supabase/`): `coach-signup` Edge Function, `create_invite` RPC,
  `search_coaches` RPC — each with tests.

**Out of scope (deferred)**
- Per-athlete **chat drawer** and the top-bar "Message" button → sub-project **D** (rendered but
  disabled/hidden).
- Athlete iOS app → **C**. Garmin/Strava → **E**. Metrics dashboard → **F**.
- OAuth (Google) for coaches — email/password only for now (button hidden/disabled).
- Hosted deploy of the SPA (local dev only this sub-project; deploy is a later concern).

**Deliverable:** a coach can sign up / log in, manage their roster (incl. pending invites), and
build/edit a week of workouts (grid + editor + library + duplicate + drag/copy) for an athlete,
backed by the real Supabase backend, with green frontend + backend tests.

---

## 2. Repo reorganization (first task)

One-time move, done before app work, so the frontend/backend split is clean:
- `tests/` → `supabase/tests/`; `scripts/seed.ts` → `supabase/scripts/seed.ts`.
- Update root `package.json` paths so `npm run seed` / `npm test` still work (Vitest `include`,
  the `seed` script path). Update `vitest.config.ts` / `tsconfig.json` includes accordingly.
- Scaffold `apps/coach-web/` (Vite React-TS) and an empty `apps/athlete-ios/` placeholder
  (`.gitkeep` + a short README stub).
- Verify the full backend suite still passes from its new location.

Result matches the layout in the root `README.md` Architecture section.

---

## 3. Backend additions (in `supabase/`)

B is mostly frontend but needs three backend pieces; each is a migration/function + tests.

### 3.1 `coach-signup` Edge Function (`supabase/functions/coach-signup/`)
- Input: `{ name, email, password, title }` (`title` ∈ coach_title enum).
- Uses the **service-role key** (server-only) to create the auth user (email/password) and promote
  the resulting profile to `role='coach'` with the chosen title — the same trusted path the seed
  uses (the browser must never hold the service-role key).
- Returns success/error; the client then signs in normally with email/password.
- Validates inputs; rejects a duplicate email cleanly. CORS configured for the SPA origin.

### 3.2 `create_invite(p_athlete_name text)` RPC
- `security definer`, `authenticated` only, callable by coaches.
- Generates a unique, human-readable code (e.g. 8 chars from an unambiguous alphabet), inserts an
  `invites` row owned by `auth.uid()` with `athlete_name = p_athlete_name`, returns the code.
- Retries on the rare unique-code collision. (RLS `invites_owner` already scopes invite rows to the
  owning coach for subsequent reads/deletes.)

### 3.3 `search_coaches(p_query text)` RPC
- `security definer`, `authenticated` only.
- Returns `{id, name, title, initials}` for profiles where `role='coach'` and name ILIKE the query.
- Needed because `profiles` RLS only exposes the caller's own + linked profiles, but the team
  popover must find *unrelated* coaches to add as assistants. Exposes only coach display fields.

### 3.4 Tests (`supabase/tests/`)
- `create_invite`: returns a code; the row is owned by the caller; another coach can't read it;
  redeeming the returned code links an athlete (end-to-end with existing `redeem_invite`).
- `search_coaches`: finds coaches by name; never returns athletes; callable by an authenticated
  coach.
- `coach-signup` function: creates a coach (role + title correct); the created user can sign in;
  a client (anon) cannot reach the service-role path (the function is the only entry).

---

## 4. App architecture (`apps/coach-web/`)

Self-contained Vite React-TS SPA, own `package.json`/build. Talks to Supabase via
`@supabase/supabase-js` using the **anon key + URL** from app env (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`). RLS is the security boundary.

**Folder structure (responsibility-scoped):**
```
apps/coach-web/
  src/
    main.tsx, App.tsx           app bootstrap + QueryClient + Router
    routes/                     /login, /signup, /coach (guarded)
    lib/
      supabase.ts               browser client (anon key)
      queries/                  TanStack Query hooks (roster, plan, library, team, invites)
    features/
      auth/                     login + signup forms; coach-signup fn call; session guard
      roster/                   sidebar, add-athlete modal, pending rows, remove confirm, profile menu
      plan-grid/                week grid, day cards, drag-move, copy/paste, duplicate week
      editor/                   workout editor panel
      library/                  workout library panel + drag source
      team/                     coaching-team cluster + popover (search_coaches)
    components/ui/              tokens'd primitives (Button, Card, Chip, Sheet, Toast, …)
    styles/theme.css            Tailwind v4 @theme: Volt Lime tokens from design.md
```

**State model:**
- **Server state** via TanStack Query: `useRoster`, `useAthletePlan(athleteId)`, `useLibrary`,
  `useTeam(athleteId)`, `usePendingInvites`. Mutations (`useUpdateWorkout`, `useMoveWorkout`,
  `usePasteWorkout`, `useDuplicateWeek`, `useCreateInvite`, `useRevokeInvite`, `useAddAssistant`,
  `useRemoveAssistant`, `useRemoveAthlete`) optimistically update then invalidate.
- **Local UI state** (not server): selected athlete id, selected day id, clipboard, modal/popover
  open flags, drag state. Kept in component/context state, not in the query cache.
- **Computed (not stored):** est-time per workout and weekly volume/sessions — computed client-side
  via a shared helper mirroring `estMinutes` in the prototype.

---

## 5. Screens & behavior

### 5.1 Auth (`/login`, `/signup`)
Split-panel (brand left, form right), Volt Lime styling.
- **Login:** email/password → `supabase.auth.signInWithPassword`; on success route to `/coach`.
  "Athlete? Open the app" link (points at the future iOS app / placeholder). OAuth button
  hidden/disabled.
- **Sign-up:** name, work email, password, **coaching title** chips → POST to `coach-signup`
  Edge Function → on success, sign in → `/coach`.

### 5.2 Route gating
`/coach` is guarded: requires a session AND `profiles.role === 'coach'`. Athletes (or no session)
are redirected to `/login` (athletes get a "use the athlete app" message). Implemented via a
session/role check using `onAuthStateChange` + a `profiles` read.

### 5.3 Roster sidebar
- Header "Athletes · n", add-athlete (+).
- One row per **active** athlete (avatar, name, level · race date, "needs check-in" dot); hover
  remove (trash) → confirm dialog → `useRemoveAthlete` (head unlinks the `coach_athlete` row).
- **Pending invite rows** (`usePendingInvites`): dimmed rows showing the athlete-name label + the
  code, with copy + revoke (delete invite). They disappear and a real athlete row appears once
  redeemed (realtime/refetch).
- "Add athlete" modal: enter a name → `useCreateInvite` → shows the generated code to copy/share.
- Bottom: coach profile button → menu (Log out; "Preview as athlete" link).

### 5.4 Top bar
Selected athlete avatar/name, status pill, goal race · date · "Week n of m". Right: **coaching-team
cluster** (head + assistants + dashed "+") → popover with `search_coaches` directory search and
add/remove assistants (head-only; enforced by RLS `team_write`). **Duplicate week** button. The
**Message** button is rendered disabled (chat = D).

### 5.5 Week plan grid
7 columns Mon–Sun. Each day = a workout card or empty slot.
- Card: title, dist · pace, neutral type icon (top-right), status row (gray dot=planned,
  green check=done, red=missed), copy icon. Color encodes **completion status only**; today = bright
  neutral ring.
- **Drag** a card to another day → `useMoveWorkout` (move/swap; status recalculated).
- **Click** a day → opens the editor for it; **click empty grid space** → closes editor (shows
  library).
- **Copy/paste:** copy icon puts a workout on an app-level clipboard; empty days show a "Paste …"
  placeholder above "Add"; clipboard persists across athletes.
- **Duplicate week:** copies the current week's workouts (used as the week template going forward;
  for MVP it duplicates into the same week's structure / next week per the prototype's behavior —
  pin exact target in the plan).

### 5.6 Workout editor (right panel, day selected)
Type chips, Title, Distance, Target pace, **Est. time (min)** (auto from dist×pace, overridable;
feeds weekly projection), **workout structure** (add/remove ordered phase rows: label + detail),
**coach's note**. Footer: **Clear day** (→ rest) / **Done** (`useUpdateWorkout`). Empty day shows
quick-add type chips.

### 5.7 Workout library (right panel, nothing selected)
"WORKOUT LIBRARY" + **New workout** (create → customize → saves as a `custom=true` template via the
library mutations). Preset + custom cards are **draggable onto any grid day** (dnd-kit). Presets are
editable.

---

## 6. Data flow, realtime, errors
- TanStack Query hooks wrap supabase-js. Mutations optimistically update the cache, then invalidate
  the affected queries; failures roll back and surface a toast.
- A realtime subscription on `workouts` (filtered to the selected athlete) invalidates that
  athlete's plan query, so the grid stays live (and reflects athlete-side completions once C ships).
- Auth: persisted supabase-js session; `onAuthStateChange` drives the route guard. Sign-out clears
  session and returns to `/login`.
- Errors: network/RLS errors → toast with a human message; the optimistic update reverts. The
  prototype's animation caveats (no long opacity transitions on conditionally-enabled buttons) are
  respected.

---

## 7. Testing
- **Backend** (`supabase/tests/`, Vitest vs local Supabase): the three additions in §3.4.
- **Frontend** (`apps/coach-web/`, Vitest + React Testing Library): render with a `QueryClient` and
  a signed-in test client against the local Supabase. Cover:
  - role-gated routing (athlete/no-session redirected from `/coach`),
  - add-athlete → pending row appears with a code,
  - drag-move updates the day / editor save persists,
  - library drag-onto-grid creates the day's workout,
  - duplicate week copies the workouts,
  - team popover search returns coaches and add/remove assistant respects head-only.

---

## 8. Open items to resolve during planning (not blocking design)
- **Duplicate-week target semantics** — duplicate into the next week vs. overwrite/clone in place;
  pin the exact behavior (and whether the schema's single-week model needs a week offset) in the
  plan, matching the prototype.
- **Invite code format/length** — exact alphabet + length for `create_invite` (default: 8 chars,
  unambiguous alphabet).
- **"Preview as athlete" link target** — until C exists, link to a placeholder or disable.
- **Realtime granularity** — per-athlete channel vs a single subscription filtered client-side;
  decide in the plan.
