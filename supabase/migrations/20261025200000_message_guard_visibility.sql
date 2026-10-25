-- The message guard lets `on delete set null` clean-ups through when the
-- referenced row is gone. It checked that under the caller's RLS, so a sender
-- who merely couldn't SEE a still-existing workout or message could null the
-- link. Check existence as definer instead.
-- The helpers live in `private`, which the API doesn't expose, so nobody can
-- call them directly to probe which ids exist. The trigger runs as whoever
-- updates the message (users, or service_role jobs like the video purge).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.message_row_exists(_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from messages where id = _id);
$$;
create or replace function private.workout_row_exists(_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from workouts where id = _id);
$$;
revoke all on function private.message_row_exists(uuid) from public, anon;
revoke all on function private.workout_row_exists(uuid) from public, anon;
grant execute on function private.message_row_exists(uuid) to authenticated, service_role;
grant execute on function private.workout_row_exists(uuid) to authenticated, service_role;

create or replace function guard_message_immutable_content() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  ignored text[] := array['read'];
begin
  -- `on delete set null` clean-ups are allowed: the referenced row is gone.
  if new.reply_to_id is null and old.reply_to_id is not null
     and not private.message_row_exists(old.reply_to_id) then
    ignored := array_append(ignored, 'reply_to_id');
  end if;
  if new.workout_id is null and old.workout_id is not null
     and not private.workout_row_exists(old.workout_id) then
    ignored := array_append(ignored, 'workout_id');
  end if;
  if current_setting('app.message_edit', true) = 'on' then
    ignored := ignored || array['body', 'edited_at'];
  end if;
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored)
     and current_user <> 'service_role' then
    raise exception 'only the read flag may be updated on a message';
  end if;
  return new;
end;
$$;
