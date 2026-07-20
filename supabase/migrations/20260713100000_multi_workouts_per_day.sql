-- Multiple workouts per day: drop the one-per-day uniqueness. The paired
-- non-unique index on (athlete_id, date) from the original schema remains for
-- lookups. App upserts that relied on ON CONFLICT (athlete_id, date) move to
-- id-addressed updates / plain inserts in the same release.
alter table workouts drop constraint if exists workouts_athlete_id_date_key;
