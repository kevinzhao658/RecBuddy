-- Quote-replies: a message can point at the message it answers.
-- on delete set null: deleting the original leaves the reply, showing
-- "Original message unavailable".
alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;
create index if not exists messages_reply_to_id_idx on messages (reply_to_id) where reply_to_id is not null;

-- A reply must quote a message in the SAME thread (no quoting across
-- conversations). Definer: the check must see the target even if RLS hides it.
create or replace function messages_reply_same_thread() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from messages where id = new.reply_to_id and thread_id = new.thread_id
  ) then
    raise exception 'a reply must quote a message in the same thread';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_reply_same_thread on messages;
create trigger messages_reply_same_thread before insert or update of reply_to_id, thread_id on messages
  for each row execute function messages_reply_same_thread();

-- Messages are immutable except for the `read` flag (participants may UPDATE
-- to mark read). The original guard listed columns explicitly, so new ones
-- (workout_id, reply_to_id) were editable. Compare every column but `read`
-- instead, so future columns are covered automatically. Service role exempt.
create or replace function guard_message_immutable_content() returns trigger as $$
declare
  ignored text[] := array['read'];
begin
  -- `on delete set null` clean-ups are allowed: the referenced row is gone.
  if new.reply_to_id is null and old.reply_to_id is not null
     and not exists (select 1 from messages where id = old.reply_to_id) then
    ignored := array_append(ignored, 'reply_to_id');
  end if;
  if new.workout_id is null and old.workout_id is not null
     and not exists (select 1 from workouts where id = old.workout_id) then
    ignored := array_append(ignored, 'workout_id');
  end if;
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored)
     and current_user <> 'service_role' then
    raise exception 'only the read flag may be updated on a message';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;
