-- One logged actual per workout. The log flow could insert a second row when
-- its local cache didn't know about the first (e.g. logging via the chat
-- trace, or unmark -> re-log), and readers took an ARBITRARY row — the coach's
-- Results panel showed a stale null-note copy while the athlete's comment sat
-- in the newer one. Keep the newest row per workout, then enforce uniqueness.

delete from workout_actuals a
using workout_actuals b
where a.workout_id is not null
  and a.workout_id = b.workout_id
  and (a.recorded_at < b.recorded_at
       or (a.recorded_at = b.recorded_at and a.id < b.id));

create unique index if not exists workout_actuals_one_per_workout
  on workout_actuals (workout_id) where workout_id is not null;
