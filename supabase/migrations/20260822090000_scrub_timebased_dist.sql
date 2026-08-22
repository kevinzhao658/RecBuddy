-- Cross and 'other' prescriptions are TIME-based: the editor hides
-- distance/pace for them, but before that change its drafts silently saved
-- default values (e.g. dist 4 / pace 9:30) while the fields were hidden.
-- Scrub those phantom values so no surface can project a distance for a
-- time-based workout. Idempotent; the editors now null these on save.
update workouts
set dist = null, pace = null
where type in ('cross', 'other')
  and (dist is not null or pace is not null);

update library_workouts
set dist = null, pace = null
where type in ('cross', 'other')
  and (dist is not null or pace is not null);
