-- ============================================================
-- RecBuddy — Seed data (mirrors the prototype's mock data)
-- Run AFTER 01_schema.sql + 02_rls.sql.
--
-- NOTE: profiles.id references auth.users(id). For a realistic seed you'd
-- create auth users first. For local/dev convenience this seed inserts
-- directly into auth.users with fixed UUIDs and bypasses the signup trigger
-- by inserting profiles explicitly. Adjust emails/passwords as needed.
-- On Supabase, prefer creating these users via the Auth admin API, then
-- run only the non-auth INSERTs below.
-- ============================================================

-- Fixed UUIDs for referential clarity
-- Coaches
--   Mara  11111111-1111-1111-1111-111111111111  (head)
--   Sam   22222222-2222-2222-2222-222222222222  (assistant)
--   Lena  33333333-3333-3333-3333-333333333333  (strength)
--   Nadia 44444444-4444-4444-4444-444444444444  (physio)
-- Athletes
--   Jordan a1111111-... Priya a2222222-... Marcus a3333333-... Sofia a4444444-...

-- ---------- auth.users (dev only; skip if using Auth admin API) ----------
insert into auth.users (id, email, raw_user_meta_data, created_at)
values
  ('11111111-1111-1111-1111-111111111111','mara@recbuddy.app', '{"role":"coach","name":"Mara Whitlock","title":"Head Coach"}', now()),
  ('22222222-2222-2222-2222-222222222222','sam@recbuddy.app',  '{"role":"coach","name":"Sam Okafor","title":"Assistant Coach"}', now()),
  ('33333333-3333-3333-3333-333333333333','lena@recbuddy.app', '{"role":"coach","name":"Lena Park","title":"Strength Coach"}', now()),
  ('44444444-4444-4444-4444-444444444444','nadia@recbuddy.app','{"role":"coach","name":"Nadia Von","title":"Physio"}', now()),
  ('a1111111-1111-1111-1111-111111111111','jordan@recbuddy.app','{"role":"athlete","name":"Jordan Reyes","experience_level":"returning","primary_goal":"pr"}', now()),
  ('a2222222-2222-2222-2222-222222222222','priya@recbuddy.app', '{"role":"athlete","name":"Priya Nair","experience_level":"new","primary_goal":"first-race"}', now()),
  ('a3333333-3333-3333-3333-333333333333','marcus@recbuddy.app','{"role":"athlete","name":"Marcus Bell","experience_level":"experienced","primary_goal":"pr"}', now()),
  ('a4444444-4444-4444-4444-444444444444','sofia@recbuddy.app', '{"role":"athlete","name":"Sofia Lindqvist","experience_level":"competitive","primary_goal":"pr"}', now())
on conflict (id) do nothing;

-- If the on_auth_user_created trigger is active, profiles are auto-created.
-- Otherwise insert profiles explicitly:
insert into profiles (id, role, name, email, title) values
  ('11111111-1111-1111-1111-111111111111','coach','Mara Whitlock','mara@recbuddy.app','Head Coach'),
  ('22222222-2222-2222-2222-222222222222','coach','Sam Okafor','sam@recbuddy.app','Assistant Coach'),
  ('33333333-3333-3333-3333-333333333333','coach','Lena Park','lena@recbuddy.app','Strength Coach'),
  ('44444444-4444-4444-4444-444444444444','coach','Nadia Von','nadia@recbuddy.app','Physio')
on conflict (id) do nothing;

insert into profiles (id, role, name, email, experience_level, primary_goal) values
  ('a1111111-1111-1111-1111-111111111111','athlete','Jordan Reyes','jordan@recbuddy.app','returning','pr'),
  ('a2222222-2222-2222-2222-222222222222','athlete','Priya Nair','priya@recbuddy.app','new','first-race'),
  ('a3333333-3333-3333-3333-333333333333','athlete','Marcus Bell','marcus@recbuddy.app','experienced','pr'),
  ('a4444444-4444-4444-4444-444444444444','athlete','Sofia Lindqvist','sofia@recbuddy.app','competitive','pr')
on conflict (id) do nothing;

-- ---------- roster: Mara is head coach of all 4; assistants per athlete ----------
insert into coach_athlete (coach_id, athlete_id, relationship) values
  ('11111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','head'),
  ('11111111-1111-1111-1111-111111111111','a2222222-2222-2222-2222-222222222222','head'),
  ('11111111-1111-1111-1111-111111111111','a3333333-3333-3333-3333-333333333333','head'),
  ('11111111-1111-1111-1111-111111111111','a4444444-4444-4444-4444-444444444444','head'),
  ('22222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111','assistant'), -- Sam → Jordan
  ('33333333-3333-3333-3333-333333333333','a3333333-3333-3333-3333-333333333333','assistant')  -- Lena → Marcus
on conflict do nothing;

-- ---------- Jordan's plan (Riverside Half, week 5 of 16) ----------
insert into plans (id, athlete_id, goal_race, goal_date, goal_distance, goal_time, goal_pace, plan_week, plan_weeks, status)
values ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111',
        'Riverside Half Marathon','2026-08-23','13.1 mi','1:48:00','8:14/mi',5,16,'On track')
on conflict (id) do nothing;

-- Jordan's current week (Jun 1–7, 2026). sets as jsonb [[label,detail],...]
insert into workouts (plan_id, athlete_id, date, type, title, dist, pace, note, sets, status) values
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-01','easy','Easy Run',4.5,'9:40/mi','Loosen up for the week. Keep HR under 145.','[]','done'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-02','speed','5 × 800m',6.0,'7:30/mi','Big session this week. Settle into 800 rhythm — the recoveries matter as much as the reps.',
    '[["Warm-up","1.5 mi easy + 4 strides"],["5 × 800m","@ 3:45 each, 400m jog recovery"],["Cool-down","1.0 mi easy"]]','today'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-03','easy','Easy Run',5.0,'9:45/mi','Recovery from intervals. Flat route, easy effort.','[]','planned'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-04','tempo','Tempo 4 mi',6.0,'8:20/mi','Stretching the tempo to 4 miles. Hold form when it gets uncomfortable.',
    '[["Warm-up","1 mi easy"],["Tempo","4 mi @ 8:20/mi"],["Cool-down","1 mi easy"]]','planned'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-05','rest','Rest Day',null,null,null,'[]','rest'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-06','long','Long Run 11 mi',11.0,'9:25/mi','Longest run of the block so far. Fuel every 4 miles.',
    '[["Steady","8 mi @ 9:30/mi"],["Finish","3 mi @ goal pace 8:14/mi"]]','planned'),
  ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','2026-06-07','cross','Cross-Train 45 min',null,null,'Bike or swim, easy aerobic. Active recovery.','[]','planned')
on conflict (athlete_id, date) do nothing;

-- One synced actual for the completed easy run
insert into workout_actuals (workout_id, athlete_id, dist, pace, time, hr, feel, source)
select id, athlete_id, 4.6, '9:36/mi', '44:09', 141, 4, 'garmin'
from workouts where athlete_id='a1111111-1111-1111-1111-111111111111' and date='2026-06-01'
on conflict do nothing;

-- ---------- Mara's workout library (a few presets + one custom) ----------
insert into library_workouts (coach_id, type, title, dist, pace, note, sets, custom) values
  ('11111111-1111-1111-1111-111111111111','easy','Easy Run',5,'9:45/mi','Conversational pace — keep it relaxed and honest.','[]',false),
  ('11111111-1111-1111-1111-111111111111','long','Long Run',10,'9:30/mi','Steady aerobic effort. Fuel every 4 miles.','[]',false),
  ('11111111-1111-1111-1111-111111111111','speed','Intervals',6,'7:30/mi','Quality session — hit your paces, respect the recoveries.',
    '[["Warm-up","1.5 mi easy"],["Reps","6 × 800m @ 3:45"],["Cool-down","1 mi easy"]]',false),
  ('11111111-1111-1111-1111-111111111111','tempo','Tempo Run',6,'8:20/mi','Comfortably hard — your half-marathon engine work.','[]',false)
on conflict do nothing;

-- ---------- A message thread (Jordan ↔ Mara) ----------
insert into message_threads (id, athlete_id, coach_id)
values ('c1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111')
on conflict (athlete_id, coach_id) do nothing;

insert into messages (thread_id, from_user_id, kind, body, payload, read, created_at) values
  ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','text','Morning! Big long run today — 9 miles, last 2 at goal pace. Fuel around mile 5.',null,true, now() - interval '3 days'),
  ('c1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','runcard',null,'{"title":"Long Run 9 mi","dist":"9.1 mi","pace":"9:22/mi","time":"1:25:14","hr":152}',true, now() - interval '3 days'),
  ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','adjust',null,'{"from":"6 × 400m","to":"5 × 800m @ 3:45","reason":"Stronger threshold stimulus"}',true, now() - interval '1 day')
on conflict do nothing;
