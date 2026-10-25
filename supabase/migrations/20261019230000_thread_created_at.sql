-- "Started <date>" in Chat Details. Existing threads take their first
-- message's time (or their last activity when they have none).
alter table message_threads add column created_at timestamptz not null default now();
update message_threads t
set created_at = coalesce((select min(m.created_at) from messages m where m.thread_id = t.id), t.updated_at);
