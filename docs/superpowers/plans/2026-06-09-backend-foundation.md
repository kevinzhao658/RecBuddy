# Backend Foundation (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the RecBuddy Supabase backend — full schema, access rules (RLS), email/password auth with a coach/athlete role split, a per-athlete one-time invite flow, dev seed data, and an integration test suite proving the access rules — so the coach web app and athlete iOS app can build against it.

**Architecture:** Postgres on Supabase. The handoff's SQL (`design_handoff_recbuddy/supabase/`) is the source of truth for the schema and RLS; we apply it as ordered migrations with three changes: (1) drop the broad athlete workout-update policy in favor of a column-safe `mark_workout_status` RPC, (2) add an `invites` table plus `resolve_invite`/`redeem_invite` RPCs, (3) replace the raw profile-insert seed with a TypeScript admin-API seed that creates real, loggable users. Access rules are verified with TypeScript integration tests (Vitest + `@supabase/supabase-js`) that act as specific signed-in users against the local Supabase stack.

**Tech Stack:** Supabase CLI (local Docker stack) · Postgres + RLS + PL/pgSQL · Node 20 + TypeScript · `@supabase/supabase-js` · Vitest · tsx · dotenv.

**Reference (read before starting):**
- `design_handoff_recbuddy/supabase/01_schema.sql` — schema (copied verbatim in Task 2)
- `design_handoff_recbuddy/supabase/02_rls.sql` — RLS (copied + edited in Task 4)
- `design_handoff_recbuddy/supabase/03_seed.sql` — seed data shapes (mirrored in TS in Task 7)
- `docs/superpowers/specs/2026-06-09-backend-foundation-design.md` — the approved design

---

## File Structure

Repo root is `/Users/kevinzhao/Documents/CodingProject/RecBuddy` (already a git repo on `main`, remote `origin`). Sub-project A creates:

```
package.json                 # backend tooling: scripts + deps
tsconfig.json
vitest.config.ts
.env                         # local Supabase URL + keys (gitignored)
.env.example                 # template, committed
supabase/
  config.toml                # from `supabase init` (edited: confirmations off)
  migrations/
    <ts>_schema.sql          # Task 2 — copied from handoff 01_schema.sql
    <ts>_rls.sql             # Task 4 — handoff 02_rls.sql minus athlete-update policy
    <ts>_mark_status.sql     # Task 5 — mark_workout_status RPC
    <ts>_invites.sql         # Task 6 — invites table + resolve/redeem RPCs
scripts/
  seed.ts                    # Task 7 — admin-API seed (real users + sample data)
tests/
  helpers.ts                 # Task 3 — admin/anon clients, createUser, signIn
  schema.test.ts             # Task 2 — schema smoke test
  auth.test.ts               # Task 3 — create user + sign in + profile trigger
  rls.test.ts                # Task 4 — access-rule isolation tests
  mark-status.test.ts        # Task 5 — column-safe mark complete
  invites.test.ts            # Task 6 — resolve/redeem invite flow
```

Each file has one responsibility: migrations are the schema source of truth; `helpers.ts` is the only place that knows how to mint clients/users; each `*.test.ts` covers one behavior area.

---

## Task 1: Backend tooling + Supabase local stack

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.env`
- Create: `supabase/config.toml` (via `supabase init`)

- [ ] **Step 1: Initialize the Node project and install dependencies**

Run from repo root:
```bash
npm init -y
npm install --save-dev typescript tsx vitest @types/node dotenv supabase
npm install @supabase/supabase-js
```

- [ ] **Step 2: Write `package.json` scripts**

Replace the `"scripts"` block in `package.json` with:
```json
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "migrate:new": "supabase migration new",
    "seed": "tsx scripts/seed.ts",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["scripts", "tests"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

Tests create users and hit a shared DB; run them serially in one process to keep ordering predictable.
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
```

- [ ] **Step 5: Initialize Supabase (email confirmation is optional)**

```bash
npx supabase init
```
The seed and tests create users via the admin API with `email_confirm: true`, so they are confirmed regardless of config — no edit is strictly required for this sub-project. Optionally, to make the *frontend* email/password signup flow (B/C) work locally without an email step, disable confirmations in `supabase/config.toml`. The key location varies by CLI version — set whichever block exists:
```toml
# newer CLI
[auth.email]
enable_confirmations = false

# older CLI
[auth]
enable_confirmations = false
```

- [ ] **Step 6: Start the local stack and capture credentials**

```bash
npm run db:start
npx supabase status
```
Copy the `API URL`, `anon key`, and `service_role key` from the output. Create `.env`:
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
```
And `.env.example` (committed) with the same keys but placeholder values:
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=replace-with-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-local-service-role-key
```
Confirm `.env` is gitignored (the root `.gitignore` already ignores `.env`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .env.example supabase/config.toml
git commit -m "chore(backend): init Supabase local stack + Node/TS tooling"
```

---

## Task 2: Apply the handoff schema as the first migration

**Files:**
- Create: `supabase/migrations/<ts>_schema.sql` (copied from `design_handoff_recbuddy/supabase/01_schema.sql`)
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/schema.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { admin } from './helpers'

describe('schema', () => {
  it('has the core tables', async () => {
    const sql = admin()
    const { data, error } = await sql
      .from('profiles')
      .select('id')
      .limit(0)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
```
(`helpers.ts` is written in Task 3; for this task, add a minimal inline `admin()` if running Task 2 first — but the recommended order writes Task 3's helper before running this. If executing strictly in order, defer running this test until Task 3 Step 1 lands `helpers.ts`.)

- [ ] **Step 2: Create the migration file**

```bash
npx supabase migration new schema
```
This creates `supabase/migrations/<timestamp>_schema.sql` (empty).

- [ ] **Step 3: Copy the handoff schema into the migration**

Copy the **entire** contents of `design_handoff_recbuddy/supabase/01_schema.sql` into the newly created `supabase/migrations/<timestamp>_schema.sql`. Do not modify it — it defines all enums (`user_role`, `coach_title`, `athlete_level`, `athlete_goal`, `team_role`, `workout_type`, `workout_status`, `plan_status`, `message_kind`, `actual_source`), all tables (`profiles`, `coach_athlete`, `plans`, `workouts`, `workout_actuals`, `library_workouts`, `message_threads`, `messages`), and the triggers (`touch_updated_at`, `bump_thread`, `handle_new_user` + `on_auth_user_created`).

```bash
cp design_handoff_recbuddy/supabase/01_schema.sql supabase/migrations/<timestamp>_schema.sql
```

- [ ] **Step 4: Apply the migration**

```bash
npm run db:reset
```
Expected: reset completes without error and reports applying the `<timestamp>_schema` migration.

- [ ] **Step 5: Run the schema test (after Task 3 helper exists)**

```bash
npm test -- schema
```
Expected: PASS — `profiles` is queryable and empty.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tests/schema.test.ts
git commit -m "feat(db): apply RecBuddy schema (enums, tables, triggers) as first migration"
```

---

## Task 3: Test harness helpers + auth/profile-trigger test

**Files:**
- Create: `supabase/migrations/<ts>_harden_auth_trigger.sql`
- Create: `tests/helpers.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Harden the new-user trigger (CRITICAL security fix)**

The handoff's `handle_new_user` reads `role`/`title` from `raw_user_meta_data`, which a client sets at `signUp()` — letting anyone self-assign the `coach` role (privilege escalation). Fix: the trigger **always** creates a profile as `'athlete'` and never reads role/title from any signup metadata. **Coaches are promoted by the trusted service role** after creation (the test harness and seed do this) — so `profiles.role` is the single source of truth and is writable only by the service role. (Note: this avoids depending on GoTrue's `app_metadata` write timing — GoTrue inserts the `auth.users` row, firing this `AFTER INSERT` trigger, *before* it persists admin-supplied `app_metadata`, so reading role from `app_metadata` here would always miss it.) Harden the SECURITY DEFINER function with a pinned `search_path` + schema-qualified casts.

```bash
npx supabase migration new harden_auth_trigger
```
Put this in `supabase/migrations/<timestamp>_harden_auth_trigger.sql` (it `create or replace`s the function from the schema migration; the existing `on_auth_user_created` AFTER INSERT trigger already points at it by name, so replacing the body is enough — do NOT recreate the trigger):
```sql
-- Security: self-signups are ALWAYS created as athletes — role/title are never
-- taken from client-supplied metadata. Coaches are promoted by the service role
-- after creation (see the test harness / seed). This closes the privilege-
-- escalation hole regardless of GoTrue's app_metadata write timing.
-- SECURITY DEFINER with a pinned search_path; enum casts schema-qualified.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, name, email, experience_level, primary_goal)
  values (
    new.id,
    'athlete',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    (new.raw_user_meta_data->>'experience_level')::public.athlete_level,
    (new.raw_user_meta_data->>'primary_goal')::public.athlete_goal
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
```
Apply it:
```bash
npm run db:reset
```
Expected: applies both the `schema` and `harden_auth_trigger` migrations without error.

- [ ] **Step 2: Write the harness helpers**

`tests/helpers.ts`:
```ts
import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } }

/** Service-role client: bypasses RLS. Use only for setup/teardown. */
export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, noPersist)
}

/** Anonymous client: subject to RLS, no user. */
export function anon(): SupabaseClient {
  return createClient(URL, ANON, noPersist)
}

export type NewUser = {
  email?: string
  password?: string
  role: 'coach' | 'athlete'
  name: string
  experience_level?: string
  primary_goal?: string
  title?: string
}

/** Create an auth user via the admin API; the handle_new_user trigger creates
 *  the profile (always as 'athlete'). Coaches are then PROMOTED via a
 *  service-role update — the only path to the coach role. Returns the user id
 *  + the credentials used.
 *  SECURITY: role/title are never set from client-supplied signup metadata;
 *  only this service-role (admin) client can grant the coach role. */
export async function createUser(u: NewUser) {
  const email = u.email ?? `${randomUUID()}@test.recbuddy.app`
  const password = u.password ?? 'test-password-123'
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: u.name,
      experience_level: u.experience_level,
      primary_goal: u.primary_goal,
    },
  })
  if (error) throw error
  const id = data.user!.id
  if (u.role === 'coach') {
    const { error: pErr } = await admin()
      .from('profiles')
      .update({ role: 'coach', title: u.title ?? null })
      .eq('id', id)
    if (pErr) throw pErr
  }
  return { id, email, password }
}

/** Sign in and return a user-scoped client (RLS applies as this user). */
export async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, noPersist)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

/** Convenience: create a user and return a signed-in client + id. */
export async function createAndSignIn(u: NewUser) {
  const { id, email, password } = await createUser(u)
  const client = await signIn(email, password)
  return { id, email, client }
}
```

- [ ] **Step 3: Write the failing auth/profile-trigger test**

`tests/auth.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

describe('auth + profile trigger', () => {
  it('creates a coach profile with role + title from app_metadata', async () => {
    const { id } = await createAndSignIn({ role: 'coach', name: 'Test Coach', title: 'Head Coach' })
    const { data, error } = await admin().from('profiles').select('*').eq('id', id).single()
    expect(error).toBeNull()
    expect(data!.role).toBe('coach')
    expect(data!.title).toBe('Head Coach')
    expect(data!.initials).toBe('TC')
  })

  it('creates an athlete profile with experience + goal', async () => {
    const { id } = await createAndSignIn({
      role: 'athlete', name: 'Runner One', experience_level: 'returning', primary_goal: 'pr',
    })
    const { data } = await admin().from('profiles').select('*').eq('id', id).single()
    expect(data!.role).toBe('athlete')
    expect(data!.experience_level).toBe('returning')
    expect(data!.primary_goal).toBe('pr')
  })

  it('does NOT let a client self-assign the coach role via user_metadata', async () => {
    // Simulate a malicious self-signup that crams role/title into user_metadata
    // (the client-writable bucket). The hardened trigger must ignore it.
    const sql = admin()
    const { data, error } = await sql.auth.admin.createUser({
      email: `escalate-${randomUUID()}@test.recbuddy.app`,
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: { role: 'coach', title: 'Head Coach', name: 'Sneaky' },
    })
    expect(error).toBeNull()
    const prof = await sql.from('profiles').select('role,title').eq('id', data.user!.id).single()
    expect(prof.data!.role).toBe('athlete') // defaulted, NOT coach
    expect(prof.data!.title).toBeNull()
  })
})
```

- [ ] **Step 4: Run the tests**

```bash
npm test -- auth schema
```
Expected: PASS. The hardened `handle_new_user` trigger (Step 1) populates `profiles` — role/title from `app_metadata`, name/experience/goal from `user_metadata`, plus the generated `initials` — and the escalation attempt defaults to `athlete`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ tests/helpers.ts tests/auth.test.ts
git commit -m "feat(db): harden handle_new_user (role via app_metadata) + test harness"
```

---

## Task 4: RLS migration (handoff policies minus athlete workout-update) + realtime

**Files:**
- Create: `supabase/migrations/<ts>_rls.sql` (from `design_handoff_recbuddy/supabase/02_rls.sql`, edited)
- Test: `tests/rls.test.ts`

- [ ] **Step 1: Write the failing access-rule tests**

`tests/rls.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, createUser, createAndSignIn, signIn } from './helpers'

describe('RLS access rules', () => {
  let coach: { id: string; email: string; client: any }
  let other: { id: string; email: string; client: any }
  let athleteA: { id: string; email: string; client: any }
  let athleteB: { id: string; email: string; client: any }
  let planA: string
  let workoutA: string

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: 'Coach A', title: 'Head Coach' })
    other = await createAndSignIn({ role: 'coach', name: 'Coach B', title: 'Head Coach' })
    athleteA = await createAndSignIn({ role: 'athlete', name: 'Athlete A' })
    athleteB = await createAndSignIn({ role: 'athlete', name: 'Athlete B' })

    const sql = admin()
    // coach A coaches athlete A (head); set up via service role
    await sql.from('coach_athlete').insert({ coach_id: coach.id, athlete_id: athleteA.id, relationship: 'head' })
    const { data: plan } = await sql.from('plans').insert({ athlete_id: athleteA.id, plan_week: 1, plan_weeks: 12 }).select().single()
    planA = plan!.id
    const { data: w } = await sql.from('workouts').insert({
      plan_id: planA, athlete_id: athleteA.id, date: '2026-06-01', type: 'easy', title: 'Easy Run', status: 'planned',
    }).select().single()
    workoutA = w!.id
  })

  it('athlete reads their own workout', async () => {
    const { data } = await athleteA.client.from('workouts').select('*').eq('id', workoutA)
    expect(data!.length).toBe(1)
  })

  it('athlete B cannot read athlete A workout', async () => {
    const { data } = await athleteB.client.from('workouts').select('*').eq('id', workoutA)
    expect(data!.length).toBe(0)
  })

  it('coach A reads their athlete workout; coach B cannot', async () => {
    const a = await coach.client.from('workouts').select('*').eq('id', workoutA)
    expect(a.data!.length).toBe(1)
    const b = await other.client.from('workouts').select('*').eq('id', workoutA)
    expect(b.data!.length).toBe(0)
  })

  it('coach A can write their athlete workout; coach B cannot', async () => {
    const ok = await coach.client.from('workouts').update({ title: 'Edited' }).eq('id', workoutA).select()
    expect(ok.data!.length).toBe(1)
    const denied = await other.client.from('workouts').update({ title: 'Hijacked' }).eq('id', workoutA).select()
    expect(denied.data!.length).toBe(0) // no row visible to update
  })

  it('assistant coach can read but cannot manage the roster (head-only)', async () => {
    const assistant = await createAndSignIn({ role: 'coach', name: 'Assistant', title: 'Assistant Coach' })
    // head coach adds the assistant to athlete A's team
    await admin().from('coach_athlete').insert({ coach_id: assistant.id, athlete_id: athleteA.id, relationship: 'assistant' })
    // assistant can read athlete A's workout
    const read = await assistant.client.from('workouts').select('*').eq('id', workoutA)
    expect(read.data!.length).toBe(1)
    // assistant tries to add ANOTHER assistant -> head-only policy denies it
    const newCoach = await createUser({ role: 'coach', name: 'Sneaky', title: 'Assistant Coach' })
    const denied = await assistant.client
      .from('coach_athlete')
      .insert({ coach_id: newCoach.id, athlete_id: athleteA.id, relationship: 'assistant' })
      .select()
    expect(denied.error).not.toBeNull()
  })

  it('coach library is private to its owner', async () => {
    await admin().from('library_workouts').insert({ coach_id: coach.id, type: 'easy', title: 'Easy 5' })
    const mine = await coach.client.from('library_workouts').select('*').eq('coach_id', coach.id)
    expect(mine.data!.length).toBeGreaterThan(0)
    const theirs = await other.client.from('library_workouts').select('*').eq('coach_id', coach.id)
    expect(theirs.data!.length).toBe(0)
  })

  it('an athlete cannot escalate their own role via a direct profile update', async () => {
    const before = await admin().from('profiles').select('role').eq('id', athleteB.id).single()
    expect(before.data!.role).toBe('athlete')
    const { error } = await athleteB.client.from('profiles').update({ role: 'coach' }).eq('id', athleteB.id)
    expect(error).not.toBeNull() // guard trigger raises
    const after = await admin().from('profiles').select('role').eq('id', athleteB.id).single()
    expect(after.data!.role).toBe('athlete') // unchanged
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- rls
```
Expected: FAIL — with no RLS yet, athlete B and coach B can read/write athlete A's rows (the "cannot" assertions fail).

- [ ] **Step 3: Create the RLS migration file**

```bash
npx supabase migration new rls
```

- [ ] **Step 4: Copy the handoff RLS, then remove the broad athlete-update policy**

Copy `design_handoff_recbuddy/supabase/02_rls.sql` into the new `supabase/migrations/<timestamp>_rls.sql`:
```bash
cp design_handoff_recbuddy/supabase/02_rls.sql supabase/migrations/<timestamp>_rls.sql
```
Then make these two edits to the migration:

1. **Delete** these two lines (the broad athlete update — replaced by the RPC in Task 5):
```sql
create policy workouts_athlete_update on workouts for update
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
```

2. **Harden the two SECURITY DEFINER helper functions** (the security review flagged `SECURITY DEFINER` without a pinned `search_path`). Add `set search_path = public, pg_temp` to each. After editing, the helpers read:
```sql
create or replace function is_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete
    where athlete_id = _athlete and coach_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function is_head_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete
    where athlete_id = _athlete and coach_id = auth.uid() and relationship = 'head'
  );
$$ language sql stable security definer set search_path = public, pg_temp;
```

3. **Add a guard against role/title self-escalation.** The `profiles_self_update` policy lets a user update their own profile row — including the `role` column (RLS can't restrict columns), which would re-open the privilege-escalation hole from a different door. Append this BEFORE UPDATE guard to the migration. It is **SECURITY INVOKER** (the default — do NOT add `security definer`) so that `current_user` reflects the caller's DB role (`authenticated` for users, `service_role` for the service key):
```sql
-- Block privilege escalation via a direct profile update: only the service
-- role may change role/title. Users may still edit their other profile fields.
-- SECURITY INVOKER (default) so current_user is the caller's role, not the owner.
create or replace function guard_profile_privileged_fields() returns trigger as $$
begin
  if (new.role is distinct from old.role or new.title is distinct from old.title)
     and current_user <> 'service_role' then
    raise exception 'role/title may only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger profiles_guard_privileged before update on profiles
  for each row execute function guard_profile_privileged_fields();
```

Leave everything else intact: all `select`/`for all` policies, the `enable row level security` statements, and the two `alter publication supabase_realtime add table ...` lines at the end (messages, workouts).

- [ ] **Step 5: Apply and re-run the tests**

```bash
npm run db:reset && npm test -- rls auth schema
```
Expected: PASS. (`db:reset` re-applies all migrations from scratch; the RLS tests now pass and the earlier tests stay green.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tests/rls.test.ts
git commit -m "feat(db): enable RLS (athlete-owned, coach-team, private library) + realtime publication"
```

---

## Task 5: Column-safe `mark_workout_status` RPC

**Files:**
- Create: `supabase/migrations/<ts>_mark_status.sql`
- Test: `tests/mark-status.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/mark-status.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, createAndSignIn } from './helpers'

describe('mark_workout_status RPC', () => {
  let athleteA: any, athleteB: any, workoutId: string

  beforeAll(async () => {
    athleteA = await createAndSignIn({ role: 'athlete', name: 'Marker A' })
    athleteB = await createAndSignIn({ role: 'athlete', name: 'Marker B' })
    const sql = admin()
    const { data: plan } = await sql.from('plans').insert({ athlete_id: athleteA.id }).select().single()
    const { data: w } = await sql.from('workouts').insert({
      plan_id: plan!.id, athlete_id: athleteA.id, date: '2026-06-02',
      type: 'easy', title: 'Easy Run', dist: 5, pace: '9:40/mi', status: 'planned',
    }).select().single()
    workoutId = w!.id
  })

  it('athlete marks their own workout done; only status changes', async () => {
    const { error } = await athleteA.client.rpc('mark_workout_status', { p_workout_id: workoutId, p_status: 'done' })
    expect(error).toBeNull()
    const { data } = await admin().from('workouts').select('*').eq('id', workoutId).single()
    expect(data!.status).toBe('done')
    expect(Number(data!.dist)).toBe(5) // unchanged
    expect(data!.title).toBe('Easy Run') // unchanged
  })

  it('athlete cannot mark someone else workout', async () => {
    const { error } = await athleteB.client.rpc('mark_workout_status', { p_workout_id: workoutId, p_status: 'done' })
    expect(error).not.toBeNull()
  })

  it('athlete has no direct UPDATE on workouts', async () => {
    const { data } = await athleteA.client.from('workouts').update({ dist: 99 }).eq('id', workoutId).select()
    expect(data ?? []).toEqual([]) // policy removed in Task 4 -> no rows updated
    const fresh = await admin().from('workouts').select('dist').eq('id', workoutId).single()
    expect(Number(fresh.data!.dist)).toBe(5)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- mark-status
```
Expected: FAIL — `mark_workout_status` does not exist yet (RPC error).

- [ ] **Step 3: Create the migration**

```bash
npx supabase migration new mark_status
```

- [ ] **Step 4: Write the RPC**

Put this in `supabase/migrations/<timestamp>_mark_status.sql`:
```sql
-- Athletes mark their own workouts complete (or undo) without being able to
-- rewrite the plan. Definer rights perform the write; we restrict to the
-- caller's own workout and to the status column only.
create or replace function mark_workout_status(p_workout_id uuid, p_status workout_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('done', 'planned') then
    raise exception 'status % is not athlete-settable', p_status;
  end if;

  update workouts
  set status = p_status
  where id = p_workout_id
    and athlete_id = auth.uid();

  if not found then
    raise exception 'workout not found or not yours';
  end if;
end;
$$;

revoke all on function mark_workout_status(uuid, workout_status) from public;
grant execute on function mark_workout_status(uuid, workout_status) to authenticated;
```

- [ ] **Step 5: Apply and re-run**

```bash
npm run db:reset && npm test -- mark-status rls
```
Expected: PASS — athlete can flip only `status` on their own workout; everyone else is denied; no direct UPDATE path exists.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tests/mark-status.test.ts
git commit -m "feat(db): add column-safe mark_workout_status RPC for athletes"
```

---

## Task 6: Invites table + `resolve_invite` / `redeem_invite`

**Files:**
- Create: `supabase/migrations/<ts>_invites.sql`
- Test: `tests/invites.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/invites.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn, anon } from './helpers'

describe('invite flow', () => {
  let coach: any
  // Unique codes per run so the suite is re-runnable without a db reset
  // (invites.code has a UNIQUE constraint and there is no per-test cleanup).
  const okCode = `CODE-OK-${randomUUID()}`
  const redeemCode = `CODE-REDEEM-${randomUUID()}`

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: 'Inviting Coach', title: 'Head Coach' })
  })

  it('coach creates an invite for their own coach_id only', async () => {
    const ok = await coach.client.from('invites').insert({ code: okCode, coach_id: coach.id, athlete_name: 'New Athlete' }).select()
    expect(ok.error).toBeNull()
    const bad = await coach.client.from('invites').insert({ code: `CODE-BAD-${randomUUID()}`, coach_id: '00000000-0000-0000-0000-000000000000' }).select()
    expect(bad.error).not.toBeNull() // with check (coach_id = auth.uid())
  })

  it('resolve_invite returns coach display info for a valid code (anon-callable)', async () => {
    const { data, error } = await anon().rpc('resolve_invite', { p_code: okCode })
    expect(error).toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].coach_name).toBe('Inviting Coach')
    expect(data![0].coach_initials).toBe('IC')
  })

  it('resolve_invite returns nothing for an unknown code', async () => {
    const { data } = await anon().rpc('resolve_invite', { p_code: `NOPE-${randomUUID()}` })
    expect(data!.length).toBe(0)
  })

  it('athlete redeems a code: links to coach as head + marks consumed', async () => {
    await coach.client.from('invites').insert({ code: redeemCode, coach_id: coach.id })
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Joining Athlete' })
    const { error } = await athlete.client.rpc('redeem_invite', { p_code: redeemCode })
    expect(error).toBeNull()
    // link exists, relationship = head
    const link = await admin().from('coach_athlete').select('*').eq('coach_id', coach.id).eq('athlete_id', athlete.id).single()
    expect(link.data!.relationship).toBe('head')
    // code now consumed -> resolve returns nothing
    const resolved = await anon().rpc('resolve_invite', { p_code: redeemCode })
    expect(resolved.data!.length).toBe(0)
    // second redeem fails cleanly
    const second = await athlete.client.rpc('redeem_invite', { p_code: redeemCode })
    expect(second.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- invites
```
Expected: FAIL — `invites` table and the RPCs do not exist.

- [ ] **Step 3: Create the migration**

```bash
npx supabase migration new invites
```

- [ ] **Step 4: Write the invites table, RLS, and RPCs**

Put this in `supabase/migrations/<timestamp>_invites.sql`:
```sql
-- Per-athlete one-time invite codes a coach hands out.
create table invites (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  coach_id     uuid not null references profiles(id) on delete cascade,
  athlete_name text,
  expires_at   timestamptz,             -- null = no expiry (MVP default)
  consumed_at  timestamptz,
  consumed_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on invites (coach_id);

alter table invites enable row level security;

-- A coach manages only their own invites.
create policy invites_owner on invites for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Preview a code before the athlete has an account: returns the coach's
-- display name + initials for a valid, unconsumed, unexpired code; else 0 rows.
create or replace function resolve_invite(p_code text)
returns table (coach_name text, coach_initials text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.name, p.initials
  from invites i
  join profiles p on p.id = i.coach_id
  where i.code = p_code
    and i.consumed_at is null
    and (i.expires_at is null or i.expires_at > now());
$$;

revoke all on function resolve_invite(text) from public;
grant execute on function resolve_invite(text) to anon, authenticated;

-- The authenticated athlete links to the coach (as head) and consumes the
-- code. Definer rights bypass coach_athlete's head-only team_write policy.
create or replace function redeem_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
begin
  select * into v from invites where code = p_code for update;

  if not found then
    raise exception 'invalid invite code';
  end if;
  if v.consumed_at is not null then
    raise exception 'invite code already used';
  end if;
  if v.expires_at is not null and v.expires_at <= now() then
    raise exception 'invite code expired';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), 'head')
  on conflict (coach_id, athlete_id) do nothing;

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;

revoke all on function redeem_invite(text) from public;
grant execute on function redeem_invite(text) to authenticated;
```

- [ ] **Step 5: Apply and re-run all tests**

```bash
npm run db:reset && npm test
```
Expected: PASS across `schema`, `auth`, `rls`, `mark-status`, and `invites`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tests/invites.test.ts
git commit -m "feat(db): add invites table + resolve_invite/redeem_invite RPCs"
```

---

## Task 7: Seed script (real dev users + sample data)

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Write the seed script**

`scripts/seed.ts` mirrors the data shapes in `design_handoff_recbuddy/supabase/03_seed.sql`, but creates **real, loggable auth users** via the admin API (the `handle_new_user` trigger fills `profiles`), then inserts the non-auth rows with service role.
```ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'recbuddy-dev' // documented dev password for every seeded user

// The trigger creates every signup as an athlete; coaches are PROMOTED here
// via the service-role client (the only path to the coach role). name/level/
// goal are non-privileged profile fields passed as user_metadata.
async function makeUser(
  email: string,
  app: { role: 'coach' | 'athlete'; title?: string },
  user: { name: string; experience_level?: string; primary_goal?: string },
) {
  // Idempotent-ish: delete an existing user with this email first.
  const { data: list } = await sql.auth.admin.listUsers()
  const existing = list.users.find((u) => u.email === email)
  if (existing) await sql.auth.admin.deleteUser(existing.id)

  const { data, error } = await sql.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: user,
  })
  if (error) throw error
  const id = data.user!.id
  if (app.role === 'coach') {
    const { error: pErr } = await sql.from('profiles').update({ role: 'coach', title: app.title ?? null }).eq('id', id)
    if (pErr) throw pErr
  }
  return id
}

async function main() {
  // ---- coaches (promoted to the coach role via the service-role update in makeUser) ----
  const mara = await makeUser('mara@recbuddy.app', { role: 'coach', title: 'Head Coach' }, { name: 'Mara Whitlock' })
  const sam  = await makeUser('sam@recbuddy.app',  { role: 'coach', title: 'Assistant Coach' }, { name: 'Sam Okafor' })

  // ---- athletes ----
  const jordan = await makeUser('jordan@recbuddy.app', { role: 'athlete' }, { name: 'Jordan Reyes', experience_level: 'returning', primary_goal: 'pr' })
  const priya  = await makeUser('priya@recbuddy.app',  { role: 'athlete' }, { name: 'Priya Nair', experience_level: 'new', primary_goal: 'first-race' })

  // ---- roster: Mara heads both; Sam assists Jordan ----
  await sql.from('coach_athlete').insert([
    { coach_id: mara, athlete_id: jordan, relationship: 'head' },
    { coach_id: mara, athlete_id: priya, relationship: 'head' },
    { coach_id: sam,  athlete_id: jordan, relationship: 'assistant' },
  ])

  // ---- Jordan's plan (Riverside Half, week 5 of 16) ----
  const { data: plan } = await sql.from('plans').insert({
    athlete_id: jordan, goal_race: 'Riverside Half Marathon', goal_date: '2026-08-23',
    goal_distance: '13.1 mi', goal_time: '1:48:00', goal_pace: '8:14/mi',
    plan_week: 5, plan_weeks: 16, status: 'On track',
  }).select().single()
  const planId = plan!.id

  // ---- Jordan's current week (Jun 1–7, 2026) ----
  await sql.from('workouts').insert([
    { plan_id: planId, athlete_id: jordan, date: '2026-06-01', type: 'easy', title: 'Easy Run', dist: 4.5, pace: '9:40/mi', note: 'Loosen up for the week. Keep HR under 145.', sets: [], status: 'done' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-02', type: 'speed', title: '5 × 800m', dist: 6.0, pace: '7:30/mi', note: 'Big session this week. Settle into 800 rhythm — the recoveries matter as much as the reps.', sets: [['Warm-up','1.5 mi easy + 4 strides'],['5 × 800m','@ 3:45 each, 400m jog recovery'],['Cool-down','1.0 mi easy']], status: 'today' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-03', type: 'easy', title: 'Easy Run', dist: 5.0, pace: '9:45/mi', note: 'Recovery from intervals. Flat route, easy effort.', sets: [], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-04', type: 'tempo', title: 'Tempo 4 mi', dist: 6.0, pace: '8:20/mi', note: 'Stretching the tempo to 4 miles. Hold form when it gets uncomfortable.', sets: [['Warm-up','1 mi easy'],['Tempo','4 mi @ 8:20/mi'],['Cool-down','1 mi easy']], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-05', type: 'rest', title: 'Rest Day', sets: [], status: 'rest' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-06', type: 'long', title: 'Long Run 11 mi', dist: 11.0, pace: '9:25/mi', note: 'Longest run of the block so far. Fuel every 4 miles.', sets: [['Steady','8 mi @ 9:30/mi'],['Finish','3 mi @ goal pace 8:14/mi']], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-07', type: 'cross', title: 'Cross-Train 45 min', dur: 45, note: 'Bike or swim, easy aerobic. Active recovery.', sets: [], status: 'planned' },
  ])

  // ---- one synced actual for the completed easy run ----
  const { data: easy } = await sql.from('workouts').select('id').eq('athlete_id', jordan).eq('date', '2026-06-01').single()
  await sql.from('workout_actuals').insert({
    workout_id: easy!.id, athlete_id: jordan, dist: 4.6, pace: '9:36/mi', time: '44:09', hr: 141, feel: 4, source: 'garmin',
  })

  // ---- Mara's workout library ----
  await sql.from('library_workouts').insert([
    { coach_id: mara, type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', note: 'Conversational pace — keep it relaxed and honest.', sets: [], custom: false },
    { coach_id: mara, type: 'long', title: 'Long Run', dist: 10, pace: '9:30/mi', note: 'Steady aerobic effort. Fuel every 4 miles.', sets: [], custom: false },
    { coach_id: mara, type: 'speed', title: 'Intervals', dist: 6, pace: '7:30/mi', note: 'Quality session — hit your paces, respect the recoveries.', sets: [['Warm-up','1.5 mi easy'],['Reps','6 × 800m @ 3:45'],['Cool-down','1 mi easy']], custom: false },
    { coach_id: mara, type: 'tempo', title: 'Tempo Run', dist: 6, pace: '8:20/mi', note: 'Comfortably hard — your half-marathon engine work.', sets: [], custom: false },
  ])

  // ---- a message thread (Jordan ↔ Mara) ----
  const { data: thread } = await sql.from('message_threads').insert({ athlete_id: jordan, coach_id: mara }).select().single()
  await sql.from('messages').insert([
    { thread_id: thread!.id, from_user_id: mara, kind: 'text', body: 'Morning! Big long run today — 9 miles, last 2 at goal pace. Fuel around mile 5.', read: true },
    { thread_id: thread!.id, from_user_id: jordan, kind: 'runcard', payload: { title: 'Long Run 9 mi', dist: '9.1 mi', pace: '9:22/mi', time: '1:25:14', hr: 152 }, read: true },
    { thread_id: thread!.id, from_user_id: mara, kind: 'adjust', payload: { from: '6 × 400m', to: '5 × 800m @ 3:45', reason: 'Stronger threshold stimulus' }, read: true },
  ])

  // ---- one pending invite for the coach "Add athlete" demo ----
  await sql.from('invites').insert({ code: 'WELCOME-RUN', coach_id: mara, athlete_name: 'Prospective Athlete' })

  console.log('Seed complete. Dev login password for every user:', PASSWORD)
  console.log('Coaches: mara@recbuddy.app, sam@recbuddy.app | Athletes: jordan@recbuddy.app, priya@recbuddy.app')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Reset the DB and run the seed**

```bash
npm run db:reset && npm run seed
```
Expected: prints "Seed complete." with the dev credentials, no errors.

- [ ] **Step 3: Verify the seed is usable via RLS (sign in as a seeded athlete)**

Run a one-off check:
```bash
npx tsx -e "import('dotenv/config').then(async()=>{const {signIn}=await import('./tests/helpers.ts');const c=await signIn('jordan@recbuddy.app','recbuddy-dev');const {data}=await c.from('workouts').select('date,title,status').order('date');console.log(data);})"
```
Expected: Jordan's 7 workouts for Jun 1–7 print, with the easy run `done` and the speed session `today`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(backend): admin-API seed with real dev users + sample plan/chat data"
```

---

## Task 8: Backend dev workflow docs

**Files:**
- Create: `supabase/README.md`

- [ ] **Step 1: Write the backend README**

`supabase/README.md`:
```markdown
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
```

- [ ] **Step 2: Final full-suite verification**

```bash
npm run db:reset && npm run seed && npm test
```
Expected: seed completes; all test files pass (`schema`, `auth`, `rls`, `mark-status`, `invites`).

- [ ] **Step 3: Commit**

```bash
git add supabase/README.md
git commit -m "docs(backend): add local dev workflow + credentials README"
```

---

## Task 9: Access-model hardening (from final review)

The whole-implementation review found gaps the per-task reviews missed. Fix the CRITICAL + IMPORTANT ones (and one cheap MINOR integrity guard) in a new migration, TDD-style.

**Files:**
- Create: `supabase/migrations/<ts>_harden_access.sql`
- Test: `tests/security.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/security.test.ts`:
```ts
import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

describe('access-model hardening (final-review fixes)', () => {
  let coachX: any, coachY: any, athlete: any, victim: any
  let athleteMsgId: string
  let victimWorkoutId: string

  beforeAll(async () => {
    coachX = await createAndSignIn({ role: 'coach', name: 'Coach X', title: 'Head Coach' })
    coachY = await createAndSignIn({ role: 'coach', name: 'Coach Y', title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Athlete One' })
    victim = await createAndSignIn({ role: 'athlete', name: 'Victim Two' })
    const sql = admin()
    await sql.from('coach_athlete').insert({ coach_id: coachX.id, athlete_id: athlete.id, relationship: 'head' })
    const { data: t } = await sql.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coachX.id }).select().single()
    const { data: am } = await sql.from('messages').insert({ thread_id: t!.id, from_user_id: athlete.id, kind: 'text', body: 'athlete original' }).select().single()
    athleteMsgId = am!.id
    const { data: vp } = await sql.from('plans').insert({ athlete_id: victim.id }).select().single()
    const { data: vw } = await sql.from('workouts').insert({ plan_id: vp!.id, athlete_id: victim.id, date: '2026-07-01', type: 'easy', title: 'Victim Run', status: 'planned' }).select().single()
    victimWorkoutId = vw!.id
  })

  it('a coach CANNOT self-link to an unrelated athlete as head (no invite bypass)', async () => {
    const { error } = await coachY.client.from('coach_athlete').insert({ coach_id: coachY.id, athlete_id: victim.id, relationship: 'head' }).select()
    expect(error).not.toBeNull()
    const link = await admin().from('coach_athlete').select('*').eq('coach_id', coachY.id).eq('athlete_id', victim.id)
    expect(link.data!.length).toBe(0)
  })

  it('a thread participant CANNOT rewrite message content, but CAN mark read', async () => {
    const tamper = await coachX.client.from('messages').update({ body: 'TAMPERED' }).eq('id', athleteMsgId).select()
    expect(tamper.error).not.toBeNull()
    const fresh = await admin().from('messages').select('body').eq('id', athleteMsgId).single()
    expect(fresh.data!.body).toBe('athlete original')
    const read = await coachX.client.from('messages').update({ read: true }).eq('id', athleteMsgId).select()
    expect(read.error).toBeNull()
    expect(read.data!.length).toBe(1)
  })

  it('an athlete CANNOT attach an actual to another athlete workout', async () => {
    const { error } = await athlete.client.from('workout_actuals').insert({
      workout_id: victimWorkoutId, athlete_id: athlete.id, dist: 3, source: 'manual',
    }).select()
    expect(error).not.toBeNull()
  })

  it('an athlete cannot end up with two head coaches via redeem', async () => {
    const code = `HEAD2-${randomUUID()}`
    await admin().from('invites').insert({ code, coach_id: coachY.id })
    const { error } = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(error).not.toBeNull() // already has a head coach
    const heads = await admin().from('coach_athlete').select('*').eq('athlete_id', athlete.id).eq('relationship', 'head')
    expect(heads.data!.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- security
```
Expected: FAIL — without the fixes, the coach self-link succeeds, the message tamper succeeds, the cross-workout actual inserts, and a second head is allowed.

- [ ] **Step 3: Create the migration**

```bash
npx supabase migration new harden_access
```

- [ ] **Step 4: Write the hardening migration**

Put this in `supabase/migrations/<timestamp>_harden_access.sql` EXACTLY:
```sql
-- Final-review access-model fixes.

-- (1) CRITICAL: coach_athlete.team_write let any coach self-link to an arbitrary
--     athlete as 'head', bypassing the invite flow (account takeover). The
--     legitimate first-head link is created by redeem_invite (SECURITY DEFINER,
--     bypasses RLS) or the service-role seed, so no client self-insert branch is
--     needed. Restrict client writes to the athlete's existing head coach.
drop policy team_write on coach_athlete;
create policy team_write on coach_athlete for all
  using (is_head_coach_of(athlete_id))
  with check (is_head_coach_of(athlete_id));

-- (2) IMPORTANT: messages_update exists for mark-as-read, but RLS can't limit
--     columns, so a thread participant could rewrite another user's message.
--     Guard: only the `read` flag may change (service role exempt). INVOKER so
--     current_user is the caller's role.
create or replace function guard_message_immutable_content() returns trigger as $$
begin
  if (new.body is distinct from old.body
      or new.kind is distinct from old.kind
      or new.payload is distinct from old.payload
      or new.from_user_id is distinct from old.from_user_id
      or new.thread_id is distinct from old.thread_id
      or new.created_at is distinct from old.created_at)
     and current_user <> 'service_role' then
    raise exception 'only the read flag may be updated on a message';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger messages_guard_content before update on messages
  for each row execute function guard_message_immutable_content();

-- (3) IMPORTANT: an actual's workout_id (if set) must belong to the same athlete
--     as the actual, so an athlete can't pin an actual onto someone else's workout.
drop policy actuals_write on workout_actuals;
create policy actuals_write on workout_actuals for all
  using (athlete_id = auth.uid() or is_coach_of(athlete_id))
  with check (
    (athlete_id = auth.uid() or is_coach_of(athlete_id))
    and (
      workout_id is null
      or exists (
        select 1 from workouts w
        where w.id = workout_actuals.workout_id
          and w.athlete_id = workout_actuals.athlete_id
      )
    )
  );

-- (4) MINOR integrity: enforce a single head coach per athlete in redeem_invite.
create or replace function redeem_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
begin
  select * into v from invites where code = p_code for update;

  if not found then
    raise exception 'invalid invite code';
  end if;
  if v.consumed_at is not null then
    raise exception 'invite code already used';
  end if;
  if v.expires_at is not null and v.expires_at <= now() then
    raise exception 'invite code expired';
  end if;
  if exists (select 1 from coach_athlete where athlete_id = auth.uid() and relationship = 'head') then
    raise exception 'athlete already has a head coach';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), 'head')
  on conflict (coach_id, athlete_id) do nothing;

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;
```

- [ ] **Step 5: Apply and run the FULL suite**

```bash
npm run db:reset && npm run seed && npm test
```
Expected: seed completes; ALL test files pass — `schema`, `auth`, `rls`, `mark-status`, `invites`, `security` (the prior invites redeem test still passes because that athlete has no prior head).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tests/security.test.ts
git commit -m "fix(db): close team_write takeover, message tampering, cross-athlete actuals; single head coach"
```

---

## Done criteria for Sub-project A
- `npm run db:reset && npm run seed && npm test` is green end-to-end.
- A coach and athlete can be created via email/password; the role + profile land via the trigger.
- RLS proven: athletes see only their own data; head/assistant coaches see their athletes; assistants can't manage the roster; libraries are private.
- Athletes can mark workouts complete (status only) and cannot otherwise edit the plan.
- The invite flow resolves (anon) and redeems (athlete) once, failing cleanly on reuse.
- Seed produces loggable demo users + a realistic week of data for building B and C.
