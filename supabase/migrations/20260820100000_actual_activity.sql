-- Explicit sport on logged results. The old rule inferred kind from pace
-- (null -> ride), which miscounted manually-logged cross sessions (a derived
-- pace made bike miles look like running miles). Athletes now declare what a
-- cross workout actually was (run/ride/swim); sync writes it directly.
-- Null = legacy row -> readers fall back to the old inference.

alter table workout_actuals
  add column if not exists activity text
  check (activity in ('run', 'ride', 'swim'));
