-- Average power for rides (watts) — optional; manual entry or Health sync.
alter table workout_actuals
  add column if not exists avg_watts int
  check (avg_watts is null or avg_watts between 1 and 2000);
