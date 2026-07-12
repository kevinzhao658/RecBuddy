-- 'other' workout type: no distance/pace/total-time metrics — just a title,
-- phases, and the coach's note (strength sessions, mobility, drills…).
alter type workout_type add value if not exists 'other';
