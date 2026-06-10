# RecBuddy — Sub-project A: Backend Foundation (Design Spec)

**Date:** 2026-06-09
**Status:** Approved (design); ready for implementation planning
**Author:** brainstormed with Claude Code

---

## 0. Context: the whole platform & where A fits

RecBuddy is a coach→athlete running-plan platform from a high-fidelity design handoff
(`RecBuddy/design_handoff_recbuddy/`). It has two user surfaces and a shared backend.

### Locked platform decisions (from brainstorming)
- **Coach app:** React desktop **web** plan-builder.
- **Athlete app:** **SwiftUI** native iOS.
- **Backend:** **Supabase** (Postgres + Auth + Realtime), using the handoff's
  `supabase/01_schema.sql`, `02_rls.sql`, `03_seed.sql` and `INTEGRATION.md` as the starting point.

### Platform decomposition (each is its own spec → plan → build cycle)

| # | Sub-project | Delivers | Depends on | MVP? |
|---|---|---|---|---|
| **A** | **Backend foundation** | Schema + RLS + seed, email/password auth with role split, invite flow | — | ✅ |
| **B** | Coach web plan-builder | Roster, week grid (drag/copy/paste), workout editor, library | A | ✅ |
| **C** | Athlete iOS plan viewer | Login/signup, plan calendar, workout detail, weekly mileage, mark-complete | A | ✅ |
| **D** | Realtime chat | Multi-coach threads + search, live messages | A, B, C | ✅ |
| **E** | Garmin/Strava ingestion | Synced run actuals | A, C | ❌ out |
| **F** | Athlete Metrics dashboard | Parked design (rings, trends, HR zones) | A, C, E | ❌ out |

**MVP = A + B + C + D.** Garmin/Strava sync (E) and Metrics (F) are explicitly deferred.

**This spec covers sub-project A only.** A stands up the *full* schema (including the chat
tables) so that D is not blocked later, even though chat realtime wiring happens in D.

---

## 1. Scope & boundaries

**In scope**
- Full Postgres schema (all tables, all enums, all triggers) including chat tables.
- Row-Level Security (RLS) policies enforcing the access model.
- Email/password authentication with a coach vs athlete role split (role reliably set on signup).
- The per-athlete **one-time invite** flow (table + two RPCs).
- A column-safe "mark workout status" RPC for athletes.
- Dev seed data: real, loggable demo accounts + sample plans/workouts/chat.
- An automated test suite proving the RLS rules and RPC behavior.

**Out of scope (for A)**
- Any UI (coach web or iOS) — those are B and C.
- Realtime subscriptions wiring in clients (the tables are added to the realtime publication
  here, but client subscriptions are D).
- OAuth providers (Apple/Google) — email/password only for now.
- Garmin/Strava ingestion (E) and Metrics (F).
- Roster auto-provisioning UI (blank plan + week of rest workouts) — that is a B concern; A
  only provides `redeem_invite` and the tables it writes.

**Deliverable:** a Supabase project (local stack + ordered migrations + seed script) that any
frontend can build against, with a green test suite proving the access rules.

---

## 2. Data model

Adopt the handoff's `01_schema.sql` **as-is**:

- **Enums:** `user_role`, `coach_title`, `athlete_level`, `athlete_goal`, `team_role`,
  `workout_type` (`easy,long,speed,tempo,recovery,cross,rest,race`),
  `workout_status` (`done,today,planned,missed,rest`), `plan_status`, `message_kind`,
  `actual_source`.
- **Tables:** `profiles` (1:1 with `auth.users`, holds role + profile, computed `initials`),
  `coach_athlete` (roster + team, `head`/`assistant`), `plans`, `workouts`
  (one per athlete per day — unique constraint; `sets` as `jsonb`; `est_minutes` optional
  override), `workout_actuals`, `library_workouts`, `message_threads` (one per athlete↔coach
  pair), `messages` (`text`/`runcard`/`adjust`, `payload jsonb`).
- **Triggers:** `touch_updated_at` (workouts), `bump_thread` (messages bump thread
  `updated_at`), `handle_new_user` (auto-create a `profiles` row from signup metadata).

### Additions to the schema (the only new data-model work in A)

1. **`invites` table**
   ```
   id          uuid pk default gen_random_uuid()
   code        text unique not null        -- the code the athlete types
   coach_id    uuid not null references profiles(id) on delete cascade
   athlete_name text                       -- optional label for the coach's reference
   expires_at  timestamptz                 -- nullable; null = no expiry (MVP default)
   consumed_at timestamptz                 -- nullable; set when redeemed
   consumed_by uuid references profiles(id) -- nullable; the athlete who redeemed
   created_at  timestamptz not null default now()
   ```

2. **`resolve_invite(p_code text)` RPC** — `security definer`, **anon-callable**.
   Returns `{ coach_name text, coach_initials text }` for a valid, unconsumed, unexpired code,
   else null/empty. Used by athlete signup step 3 to display *"Code matches Coach …"* **before**
   the athlete has a session. Must expose nothing beyond the coach's display name + initials.

3. **`redeem_invite(p_code text)` RPC** — `security definer`, called by the **authenticated
   athlete**. Validates the code is unconsumed and unexpired; inserts
   `coach_athlete(coach_id, auth.uid(), 'head')`; sets `consumed_at = now()`,
   `consumed_by = auth.uid()`. Idempotency/safety: a second redeem of the same code must fail
   cleanly. Definer rights are required because the athlete's own session cannot satisfy the
   `team_write` policy on `coach_athlete`.

---

## 3. Auth & invite flow

- **Email/password** via Supabase Auth. No OAuth yet (the design's Apple/Google buttons are
  deferred to a later milestone; frontends may show them disabled or hidden).
- **Signup metadata (hardened — see §8.4):** `role` and `title` are privilege-bearing, so the
  `handle_new_user` trigger reads them **only from `app_metadata`** (which only the service-role
  key can write) and **defaults self-signups to `'athlete'`**. Non-privileged profile fields
  (`name`, `experience_level`, `primary_goal`) come from client-supplied `user_metadata`
  (`options.data`). Consequence: **athletes self-sign-up** (role defaults to athlete);
  **coaches are provisioned through a trusted path** (service-role / admin API now — the seed
  does exactly this — and a server endpoint behind the future coach-signup screen). A
  guarantees `profiles.role` is reliably and safely set for every new user.
- **Linking flow (per-athlete, one-time codes):**
  1. A **coach** generates an invite → inserts an `invites` row with a unique `code` (and an
     optional `athlete_name` label). (The generation *UI* is a B concern; A provides the table
     and any RPC needed to create a code.)
  2. The **athlete** self-signs-up (email/password), then during signup step 3 types the code;
     the app calls `resolve_invite` to confirm the coach, then on finish calls `redeem_invite`,
     which links them to that coach as `head` and marks the code consumed.
- **Role routing** (sending coaches to the coach app, athletes to the iOS app) is a frontend
  concern (B/C); A only guarantees the role is trustworthy.

---

## 4. Access rules (RLS)

Adopt the handoff's `02_rls.sql` policies **wholesale**, including the `is_coach_of` and
`is_head_coach_of` `security definer` helpers:

- **profiles:** read your own + people you're linked to; update only your own.
- **coach_athlete:** readable by the athlete and any coach on the row; **only the head coach**
  manages roster/team membership.
- **plans / workouts / workout_actuals:** athlete reads own; head + assistant coaches
  read/write their athletes'.
- **library_workouts:** a coach owns only their own library.
- **message_threads / messages:** visible to the athlete and the athlete's whole coaching team
  (assistants follow the chat); senders must be `auth.uid()`.
- Realtime publication: `messages` and `workouts` are added to `supabase_realtime`.

### One change (safety fix)

The shipped `workouts_athlete_update` policy grants the athlete row-level update on their own
workouts — but Postgres RLS cannot restrict *which columns* are updated, so an athlete could
rewrite the whole workout (distance, pace, structure), not just mark it done. Replace it:

- **Drop** the broad `workouts_athlete_update` policy.
- **Add** `mark_workout_status(p_workout_id uuid, p_status workout_status)` — `security
  definer` — which verifies the caller is the workout's athlete (`auth.uid()`), then updates
  **only** the `status` column. (Constrain the allowed transitions to the athlete-relevant set,
  e.g. marking `done`.) Coaches retain full write via the existing `workouts_coach_write`.

---

## 5. Seed & local dev

- Runs on the **Supabase CLI local stack** (Docker). Schema, RLS, helpers, and the new RPCs
  live as ordered files under `supabase/migrations/`.
- The shipped `03_seed.sql` inserts `profiles` rows directly, but with real auth those rows need
  matching `auth.users` or no one can log in. **Replace the profile-insert portion** with a
  small **TypeScript seed script** that uses the **service-role admin API** to create known dev
  users (1 coach, 2 athletes; fixed, documented passwords), letting the `handle_new_user`
  trigger build their profiles. The script then inserts their plans, workouts, library
  workouts, threads, and messages (these non-auth rows can reuse the shipped seed's data shapes).
- `supabase db reset` applies migrations; the seed script runs after (wired so
  `supabase db reset` / a documented `npm run seed` produces a fully usable local environment).

---

## 6. Testing strategy

**TS integration tests (Vitest) against the local Supabase**, each test acting as a specific
signed-in user (real JWT), asserting the access rules behave. Chosen over pgTAP because it
mirrors exactly how the real apps talk to the DB.

Minimum coverage:
- Athlete A **cannot** read or modify Athlete B's workouts/plans/profile.
- A coach reads/writes only their own athletes' data; not unrelated athletes'.
- An **assistant** coach can read their athlete's chat/workouts but **cannot** edit roster/team
  membership (head-only).
- `mark_workout_status` changes **only** `status` and only for the workout's own athlete;
  rejects an athlete touching someone else's workout.
- `resolve_invite` returns the coach display info for a valid code and nothing for an
  invalid/consumed/expired code.
- `redeem_invite` links the athlete on first use and **fails cleanly on a second redeem**.

These give red/green TDD cycles per policy/RPC.

---

## 7. Repo structure

Single git repo (monorepo). Top-level layout (filled across sub-projects):

```
/                      ← repo root (monorepo)
  supabase/            ← A: migrations, seed script, integration tests, config
  coach-web/           ← B (empty until B)
  ios-athlete/         ← C (empty until C)
  docs/superpowers/    ← specs + plans
  RecBuddy/            ← original design handoff (reference; source of truth for UX/tokens)
```

Sub-project A fills only `supabase/` (and creates `docs/`). Git is not yet initialized in the
working directory; initialization is a first step of the A implementation plan.

---

## 8. Judgment calls made during design (explicitly approved)

1. **Column-safe mark-complete** (§4) — replace the broad athlete-update RLS policy with a
   `security definer` RPC that flips only `status`. *Safer: athletes can't rewrite the plan.*
2. **Admin-API seed script** (§5) — create real, loggable demo accounts instead of raw profile
   inserts. *Usable: you can actually log in as the demo users while building B and C.*
3. **Vitest integration tests over pgTAP** (§6) — test the way the real clients hit the DB.
4. **Role assignment hardened against privilege escalation** (§3) — added after an automated
   security review flagged the handoff's `handle_new_user` reading `role`/`title` from
   client-writable `user_metadata` (any signup could self-assign `coach`). Fixed: read
   `role`/`title` from `app_metadata` (service-role only), default to `'athlete'`, and pin
   `search_path` on the SECURITY DEFINER trigger + RLS helper functions. Athletes self-sign-up;
   coaches are provisioned via a trusted/service-role path. *Approved by the user.*

---

## 9. Open items to resolve during planning (not blocking design)
- Exact mechanism/RPC for a coach to *create* an invite code (could be a plain insert under an
  `invites` RLS policy, or a `create_invite` RPC) — decide in the plan; both satisfy this design.
- Allowed `mark_workout_status` transitions (likely `planned/today → done`, and possibly
  reverting) — pin down concrete enum values in the plan.
