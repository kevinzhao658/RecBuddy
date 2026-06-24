-- Hybrid workout references in chat: a coach can share a scheduled workout as a
-- message that BOTH carries a display snapshot (payload) AND links to the live
-- workout row (workout_id) for click-through / sync. on delete set null keeps
-- the snapshot usable if the workout is later removed.
alter type message_kind add value if not exists 'workout';
alter table messages add column if not exists workout_id uuid references workouts(id) on delete set null;

-- No RLS change needed: messages_send/read already gate by thread membership,
-- and workout_id is just a nullable reference within an already-authorized row.
