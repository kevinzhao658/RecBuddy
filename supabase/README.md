# RecBuddy Backend (Supabase)

Local Postgres + Auth + Realtime for the coach web app and athlete iOS app.

## Prerequisites
- Docker Desktop running
- Node 20+

## First-time setup
1. `npm install`
2. `npm run db:start` — starts the local Supabase stack (Docker)
3. `npx supabase status` — copy the `anon` and `service_role` keys into `.env` (see `.env.example`)
4. `npm run db:reset` — applies all migrations from scratch
5. `npm run seed` — creates demo users + sample data

## Dev credentials (local only)
Every seeded user's password is `recbuddy-dev`.
- Coaches: `mara@recbuddy.app` (head), `sam@recbuddy.app` (assistant)
- Athletes: `jordan@recbuddy.app`, `priya@recbuddy.app`

## Common commands
- `npm test` — run the RLS / RPC integration tests against the local stack
- `npm run db:reset` — wipe + re-apply migrations (then re-run `npm run seed`)
- `npm run migrate:new <name>` — scaffold a new migration

## What's here
- `migrations/` — schema, RLS, and RPCs (the source of truth)
- `../scripts/seed.ts` — admin-API seed (real auth users + sample data)
- `../tests/` — integration tests acting as specific signed-in users

## Notes
- **Roles are assigned safely.** The `handle_new_user` trigger creates every
  signup as an `'athlete'` and never reads role/title from signup metadata.
  Coaches are promoted by a **service-role `profiles` update** (the seed / admin
  API now; a server endpoint behind the future coach-signup screen), and a
  BEFORE UPDATE guard blocks anyone but the service role from changing
  `role`/`title`. So a client cannot self-assign `coach` (not via `user_metadata`,
  not via a direct profile update).
- Athletes mark workouts complete only via the `mark_workout_status` RPC (they
  have no direct UPDATE on `workouts`).
- Invite flow: a coach inserts an `invites` row; the athlete previews it with
  `resolve_invite(code)` (anon) and links via `redeem_invite(code)` after signup.
- OAuth (Apple/Google), Garmin/Strava sync, and the metrics dashboard are out of
  scope for this sub-project.
