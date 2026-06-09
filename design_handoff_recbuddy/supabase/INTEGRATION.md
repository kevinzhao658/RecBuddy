# RecBuddy — Backend Integration Guide (Supabase + Vercel)

This maps the prototype to a **Supabase** backend and a **Vercel**-hosted frontend. Read alongside the root `README.md` (data model + screen reference).

## 0. Files
```
supabase/
  01_schema.sql   -- tables, enums, triggers (incl. profile-on-signup)
  02_rls.sql      -- row-level security (run after schema)
  03_seed.sql     -- mock data as seed (run last)
```
Apply via the SQL editor in order, or wire them as migrations: `supabase/migrations/<ts>_schema.sql` etc. and `supabase db push`. Put `03_seed.sql` in `supabase/seed.sql` so `supabase db reset` loads it automatically.

## 1. Stack
- **Frontend:** Next.js (App Router) on Vercel. Coach = desktop web route group; Athlete = mobile-first web route group (or a separate Expo app sharing the data layer).
- **Auth/DB/Realtime:** Supabase. Use `@supabase/ssr` for Next.js server components + middleware session refresh.
- **Env (Vercel project settings):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` (never expose to client) for admin tasks (Garmin webhooks, seeding users).

## 2. Auth → replaces the fake `authed` boolean
The prototype gates each app behind a boolean. Replace with Supabase Auth.

**Sign-up** — pass profile fields as user metadata so the `on_auth_user_created` trigger populates `profiles`:
```ts
// athlete signup (3-step wizard collects these)
await supabase.auth.signUp({
  email, password,
  options: { data: { role: 'athlete', name, experience_level, primary_goal } }
});
// coach signup
await supabase.auth.signUp({
  email, password,
  options: { data: { role: 'coach', name, title } }   // title: 'Head Coach' | ...
});
```
The athlete invite code (step 3) → after signup, resolve the code to a coach and `insert into coach_athlete (coach_id, athlete_id, 'head')`. Store invite codes in a small `invites` table (coach_id, code) — not in the seed yet; add it.

**Role routing:** read `profiles.role` post-login; send coaches to `/coach`, athletes to `/app`. Enforce with middleware so the wrong role can't load the other surface.

**OAuth:** the UI shows "Continue with Apple" (athlete) and "Continue with Google" (coach) — wire `supabase.auth.signInWithOAuth({ provider })`.

## 3. Screen → query cheatsheet

### Athlete · Plan (calendar)
```ts
// week or month range
const { data: workouts } = await supabase
  .from('workouts').select('*, workout_actuals(*)')
  .eq('athlete_id', uid)
  .gte('date', weekStart).lte('date', weekEnd)
  .order('date');
```
- **Weekly mileage bar**: `planned = Σ dist`, `done = Σ dist where status='done'`.
- **Mark complete**: `update workouts set status='done' where id=…` (RLS policy `workouts_athlete_update` allows the athlete; restrict to the `status` column in your API/RPC so athletes can't rewrite the plan).
- **Est. time**: compute client-side via the shared helper (see `app/core.jsx` `estMinutes`) — `est_minutes` overrides, else `dist × paceSeconds / 60`.

### Athlete · Coach (chat) — multi-thread + search
```ts
// conversation list
const { data: threads } = await supabase
  .from('message_threads')
  .select('*, coach:profiles!message_threads_coach_id_fkey(name,title,initials), messages(body,kind,created_at)')
  .eq('athlete_id', uid).order('updated_at', { ascending:false });
// search across history (server-side): use ilike or full-text
.from('messages').select('*').textSearch('body', query)  // or .ilike('body', `%${q}%`)
```
Subscribe to new messages: `supabase.channel('msgs').on('postgres_changes', {event:'INSERT', schema:'public', table:'messages', filter:`thread_id=eq.${threadId}`}, …)`.

### Coach · roster + plan grid
```ts
// roster (athletes I coach, head or assistant)
const { data: roster } = await supabase
  .from('coach_athlete')
  .select('relationship, athlete:profiles!coach_athlete_athlete_id_fkey(*), plans(*)')
  .eq('coach_id', uid);
```
- **Add athlete** (modal): create the athlete (invite flow or admin-create), then `insert coach_athlete (uid, athleteId, 'head')` + a blank `plans` row + 7 `rest` workouts for the week.
- **Remove athlete** (confirm dialog): head coach deletes the `coach_athlete` row (cascade handles owned data only if you want that — otherwise just unlink).
- **Drag-move / copy-paste / edit**: `update`/`insert` on `workouts`. Coach writes gated by `workouts_coach_write` (head or assistant).
- **Assistant coaches** (team popover w/ directory search): `insert`/`delete` on `coach_athlete` with `relationship='assistant'` — **head only** (policy `team_write`). Directory search = `from('profiles').select().eq('role','coach').ilike('name', …)`.
- **Workout library**: `from('library_workouts').eq('coach_id', uid)`; "New workout" inserts with `custom=true`.
- **Est. weekly vol. / Time-on-feet**: aggregate `dist` and `estMinutes` across the selected athlete's week.

### Coach ↔ athlete chat drawer
Same `messages`/`message_threads` tables; the drawer is the coach side of a thread. Assistants can read/post too (RLS allows the whole team).

## 4. Realtime
`messages` and `workouts` are added to the `supabase_realtime` publication (end of `02_rls.sql`). Subscribe in the chat views and the calendar so a coach's plan edit reflects on the athlete's calendar live — this closes the gap the prototype couldn't (the two HTML apps don't share state).

## 5. Garmin/Strava ingestion (later milestone)
- OAuth connect buttons exist in athlete sign-up step 3 + account sheet.
- Build a server route (Vercel serverless / edge function or a Supabase Edge Function) to receive provider webhooks, match activity → `workouts` by athlete+date, and upsert `workout_actuals`. Use the service-role key server-side only.

## 6. Notes / gotchas
- **Computed fields are not stored** (est time, weekly volume, adherence, streak, pace trend, HR zones). Compute in the app or in SQL views. The athlete **Metrics** view (`app/metrics.jsx`) is fully designed but currently not mounted — these aggregates feed it if you ship it.
- **`sets`** is `jsonb` (array of `[label, detail]`). Promote to a child table only if you need to query within phases.
- **One workout per athlete per day** is enforced by a unique constraint — matches the calendar model. Relax if you support двойные sessions.
- **Status vs. type colors:** in the UI, color encodes *completion status only* (gray/green/red); workout *type* is a neutral icon. Keep that split when binding data → styles.
- Lift exact design tokens from `design.md`; do not eyeball from screenshots.
