# RecBuddy

A coaching platform where running coaches build custom training plans for their athletes.

- **Coach app** — desktop web plan-builder (React) · *sub-project B, not started*
- **Athlete app** — native iOS (SwiftUI) plan calendar + chat · *sub-project C, not started*
- **Backend** — Supabase (Postgres + Auth + Realtime) · *✅ sub-project A, complete*

The original design handoff (high-fidelity prototype, design system, data model) lives in
[`design_handoff_recbuddy/`](design_handoff_recbuddy/) and is the source of truth for UX and
visual design. Specs and implementation plans live in [`docs/superpowers/`](docs/superpowers/).

## Architecture (high level)

**Two independent frontend apps over one shared backend.** Each frontend builds, tests, and
deploys on its own; they share *only* the backend contract (Postgres schema + RLS + RPCs), never
code.

```
   apps/coach-web (React SPA)          apps/athlete-ios (SwiftUI)
            │                                   │
            └──────────── HTTPS ────────────────┘
                          │
                  Supabase backend
        Postgres + RLS + RPCs · Auth · Realtime · Edge Functions
```

- **Backend (`supabase/`)** — Postgres is the single source of truth. Access is enforced in the
  database via Row-Level Security, so clients hold only the public **anon** key; the **service_role**
  key is server-only (seed + Edge Functions). Privileged actions (coach signup/promotion) run in
  Edge Functions, never in a client.
- **Coach web (`apps/coach-web/`)** — Vite + React + TypeScript SPA. TanStack Query for all
  server state (reads/mutations/cache + realtime invalidation), React Router, Tailwind v4 with the
  Volt Lime design tokens. Talks to Supabase via `@supabase/supabase-js`.
- **Athlete iOS (`apps/athlete-ios/`)** — native SwiftUI app using the Supabase Swift SDK.
- **Contract = the migrations.** Both apps depend on the schema/RLS/RPCs; changing the contract
  means a new migration in `supabase/migrations/`, applied locally then pushed to cloud.

## Repo layout

```
supabase/                backend (the only shared dependency)
  migrations/            schema, RLS, RPCs — the source of truth / contract
  functions/             Edge Functions (privileged server actions, e.g. coach signup)
  scripts/seed.ts        dev seed — demo users + sample data
  tests/                 integration suite (Vitest) proving the access rules
  README.md              backend access model + invite/role details
apps/
  coach-web/             sub-project B — React SPA (own package.json/build/deploy)
  athlete-ios/           sub-project C — SwiftUI Xcode project
docs/superpowers/        specs + implementation plans
design_handoff_recbuddy/ original design handoff (UX + visual source of truth)
package.json             backend tooling commands (db:*, seed, test)
```

> Layout note: backend tooling is being consolidated under `supabase/` and the frontends under
> `apps/` as part of sub-project B. Until that lands, `tests/` and `scripts/` still sit at the repo
> root.

## Backend: local development

The local backend runs the full Supabase stack (Postgres, Auth, API) in **Docker** via the
Supabase CLI. Data persists in Docker volumes across restarts and reboots.

### First-time setup (once)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it
2. `npm install`
3. `npm run db:start` — boots the local Supabase stack
4. `npx supabase status` — copy the `anon` and `service_role` keys into `.env`
   (copy `.env.example` to `.env` first). These local keys are fixed — this is a one-time step.
5. `npm run db:reset` — applies all migrations from scratch
6. `npm run seed` — creates demo users + sample data

### Every session after that

1. Make sure Docker Desktop is running
2. `npm run db:start`

That's it — your data persisted. Only reset/reseed when you want a clean slate or after new
migrations land:

```bash
npm run db:reset && npm run seed
```

### Common commands

| Command | What it does |
|---|---|
| `npm run db:start` / `db:stop` | start / stop the local stack |
| `npm run db:reset` | wipe + re-apply all migrations (destructive, local only) |
| `npm run seed` | create demo users + sample data |
| `npm test` | run the integration test suite against the local stack |
| `npm run migrate:new <name>` | scaffold a new migration |

### Demo credentials (local only)

Every seeded user's password is `recbuddy-dev`.

- Coaches: `mara@recbuddy.app` (head), `sam@recbuddy.app` (assistant)
- Athletes: `jordan@recbuddy.app`, `priya@recbuddy.app`

More backend detail (access model, invite flow, role safety): [`supabase/README.md`](supabase/README.md).

## Backend: cloud / production (hosted Supabase)

The cloud project is a **deploy target**, not a dev scratchpad — keep developing locally and
push the same migrations up when deploying.

### One-time link + deploy

```bash
npx supabase login                          # interactive — opens browser
npx supabase link --project-ref <your-ref>  # ref is in your project's dashboard URL
npx supabase db push                        # replays all migrations onto the cloud DB
```

Re-run `npx supabase db push` whenever new migrations land.

### Keys (Dashboard → Project Settings → API)

| Value | Used by | Secret? |
|---|---|---|
| Project URL (`https://<ref>.supabase.co`) | all clients + server | no |
| `anon` / publishable key | iOS app, coach web — safe to embed; RLS protects data | no |
| `service_role` / secret key | seed script + server-side admin only | **yes — never in clients, never committed** |

> Newer Supabase projects label these "publishable" and "secret" keys; the legacy
> `anon`/`service_role` JWTs are under the *Legacy API keys* tab. Either works with this
> codebase — just be consistent.

### Rules of engagement for the cloud DB

- **Never** run `npm run db:reset` or `npm test` against the cloud project — both are
  destructive/noisy by design. They are local-only.
- Keep `.env` pointed at **local**. To seed the cloud project once (optional demo data),
  pass the cloud values inline for that single run:
  ```bash
  SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret-key> npm run seed
  ```

## Status / roadmap

| # | Sub-project | Status |
|---|---|---|
| A | Backend foundation (schema, RLS, auth, invites, seed, tests) | ✅ done — 23/23 tests |
| B | Coach web plan-builder | next |
| C | Athlete iOS app | planned |
| D | Realtime chat | planned (tables already in schema) |
| E | Garmin/Strava ingestion | out of MVP |
| F | Athlete metrics dashboard | out of MVP |
