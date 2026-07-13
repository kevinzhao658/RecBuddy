-- Stream logged-run changes: when an athlete logs or edits a run, the coach's
-- open Results panel refreshes live instead of holding a stale (or empty)
-- comment until reload. RLS still scopes events to the athlete's coaches.
alter publication supabase_realtime add table workout_actuals;
