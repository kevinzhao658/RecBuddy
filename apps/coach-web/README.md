# RecBuddy Coach (web)

Vite + React + TS SPA for coaches. Talks to the Supabase backend in `../../supabase`
via `@supabase/supabase-js` (anon key; RLS is the security boundary). Server state is
managed with TanStack Query; styling uses Tailwind v4 with the Volt Lime design tokens.

## Dev setup
1. From the repo root, start the backend: `npm run db:start && npm run db:reset && npm run seed`
2. `cp .env.example .env.local` and fill `VITE_SUPABASE_ANON_KEY` from `npx supabase status`
   (the URL is the local default `http://127.0.0.1:54321`).
3. Coach signup hits an Edge Function — serve it locally (in a separate terminal):
   `npx supabase functions serve coach-signup --no-verify-jwt`
   (The `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` it needs are auto-injected by the local
   edge runtime — no `--env-file` required.)
4. `npm run dev`

Demo coach login: `mara@recbuddy.app` / `recbuddy-dev`. (Athlete logins exist too but the
athlete app is sub-project C.)

## Test
`npm test` — Vitest + React Testing Library. Component tests mock the query hooks; the
data-layer tests are integration tests that hit the local Supabase, so the stack must be
running (`npm run db:reset` for a clean slate).

## Scripts
- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm test` — run the test suite

## What's here
- `src/routes/` — login, signup, coach dashboard (guarded)
- `src/features/` — roster, plan-grid, editor, library, team
- `src/lib/queries/` — TanStack Query hooks (one module per domain)
- `src/lib/` — supabase client, types, week/est helpers
- `src/auth/` — session/role context + coach-only guard

## Not yet built
Chat (the "Message" button is disabled) → sub-project D. Garmin/Strava sync and the
athlete metrics dashboard are out of MVP scope.
