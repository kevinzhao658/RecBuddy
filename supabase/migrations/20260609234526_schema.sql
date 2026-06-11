-- ============================================================
-- RecBuddy — Supabase schema
-- Run in the Supabase SQL editor (or supabase db push via migration).
-- Order: enums → tables → indexes → RLS (see 02_rls.sql) → seed (03_seed.sql)
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------- Enums ----------
create type user_role        as enum ('coach', 'athlete');
create type coach_title      as enum ('Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio');
create type athlete_level    as enum ('new', 'returning', 'experienced', 'competitive');
create type athlete_goal     as enum ('fit', 'first-race', 'pr', 'distance');
create type team_role        as enum ('head', 'assistant');
create type workout_type     as enum ('easy', 'long', 'speed', 'tempo', 'recovery', 'cross', 'rest', 'race');
create type workout_status   as enum ('done', 'today', 'planned', 'missed', 'rest');
create type plan_status      as enum ('On track', 'Crushing it', 'Needs check-in');
create type message_kind     as enum ('text', 'runcard', 'adjust');
create type actual_source    as enum ('garmin', 'strava', 'manual');

-- ============================================================
-- profiles — extends auth.users (1:1). Supabase Auth owns identity;
-- this row holds role + app profile. Populated via trigger on signup.
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null,
  name          text not null,
  email         text not null,
  initials      text generated always as (
                  upper(left(split_part(name,' ',1),1) ||
                        coalesce(left(nullif(split_part(name,' ',2),''),1),''))
                ) stored,
  -- athlete-only
  experience_level athlete_level,
  primary_goal     athlete_goal,
  -- coach-only
  title            coach_title,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- coach_athlete — roster + coaching team (head owns; assistants assist)
-- ============================================================
create table coach_athlete (
  coach_id      uuid not null references profiles(id) on delete cascade,
  athlete_id    uuid not null references profiles(id) on delete cascade,
  relationship  team_role not null default 'assistant',
  created_at    timestamptz not null default now(),
  primary key (coach_id, athlete_id)
);
create index on coach_athlete (athlete_id);
create index on coach_athlete (coach_id);

-- ============================================================
-- plans — one active training plan per athlete (extendable to many)
-- ============================================================
create table plans (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references profiles(id) on delete cascade,
  goal_race     text,
  goal_date     date,
  goal_distance text,            -- e.g. '13.1 mi'
  goal_time     text,            -- e.g. '1:48:00'
  goal_pace     text,            -- e.g. '8:14/mi'
  plan_week     int not null default 1,
  plan_weeks    int not null default 12,
  status        plan_status not null default 'On track',
  created_at    timestamptz not null default now()
);
create index on plans (athlete_id);

-- ============================================================
-- workouts — the heart of the app. One row per scheduled day-workout.
-- 'sets' kept as jsonb array of [label, detail] pairs for simplicity;
-- promote to a child table if you need to query inside phases.
-- est_minutes is an OPTIONAL override; if null, compute in the app
-- (dist * paceSeconds / 60, else dur, else 45 for cross, else 0).
-- ============================================================
create table workouts (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  athlete_id    uuid not null references profiles(id) on delete cascade,
  date          date not null,
  type          workout_type not null,
  title         text not null,
  dist          numeric(5,2),          -- miles, nullable
  pace          text,                  -- '7:30/mi', nullable
  est_minutes   int,                   -- explicit override only
  dur           int,                   -- minutes, for cross/rest
  note          text,                  -- coach note shown to athlete
  sets          jsonb not null default '[]'::jsonb,  -- [["5 × 800m","@ 3:45..."]]
  status        workout_status not null default 'planned',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (athlete_id, date)
);
create index on workouts (athlete_id, date);
create index on workouts (plan_id);

-- ============================================================
-- workout_actuals — synced/logged run data (1:1 with a workout, or
-- standalone if athlete_id set and workout_id null for unplanned runs)
-- ============================================================
create table workout_actuals (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid references workouts(id) on delete cascade,
  athlete_id    uuid not null references profiles(id) on delete cascade,
  dist          numeric(5,2),
  pace          text,
  time          text,          -- elapsed, e.g. '1:25:14'
  hr            int,           -- avg bpm
  feel          int check (feel between 1 and 5),
  source        actual_source not null default 'garmin',
  recorded_at   timestamptz not null default now()
);
create index on workout_actuals (workout_id);
create index on workout_actuals (athlete_id);

-- ============================================================
-- library_workouts — coach's reusable templates (presets + custom)
-- ============================================================
create table library_workouts (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references profiles(id) on delete cascade,
  type          workout_type not null,
  title         text not null,
  dist          numeric(5,2),
  pace          text,
  est_minutes   int,
  note          text,
  sets          jsonb not null default '[]'::jsonb,
  custom        boolean not null default false,  -- coach-created vs seeded preset
  created_at    timestamptz not null default now()
);
create index on library_workouts (coach_id);

-- ============================================================
-- message_threads — one per (athlete, coach) pair
-- ============================================================
create table message_threads (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references profiles(id) on delete cascade,
  coach_id      uuid not null references profiles(id) on delete cascade,
  updated_at    timestamptz not null default now(),
  unique (athlete_id, coach_id)
);
create index on message_threads (athlete_id);
create index on message_threads (coach_id);

-- ============================================================
-- messages — text / runcard / adjust. payload holds card data.
--   runcard payload: {title,dist,pace,time,hr}
--   adjust  payload: {from,to,reason}
-- ============================================================
create table messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references message_threads(id) on delete cascade,
  from_user_id  uuid not null references profiles(id) on delete cascade,
  kind          message_kind not null default 'text',
  body          text,
  payload       jsonb,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on messages (thread_id, created_at);

-- ============================================================
-- updated_at trigger for workouts + threads
-- ============================================================
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger workouts_touch before update on workouts
  for each row execute function touch_updated_at();

-- bump thread.updated_at when a message lands
create or replace function bump_thread() returns trigger as $$
begin update message_threads set updated_at = now() where id = new.thread_id; return new; end;
$$ language plpgsql;
create trigger messages_bump after insert on messages
  for each row execute function bump_thread();

-- ============================================================
-- New-user trigger: create a profile row from auth signup metadata.
-- Pass role/name/title/etc in options.data at signUp() time.
-- ============================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, name, email, experience_level, primary_goal, title)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'athlete'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    (new.raw_user_meta_data->>'experience_level')::athlete_level,
    (new.raw_user_meta_data->>'primary_goal')::athlete_goal,
    (new.raw_user_meta_data->>'title')::coach_title
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
