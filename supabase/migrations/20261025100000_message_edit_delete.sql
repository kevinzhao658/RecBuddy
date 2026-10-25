-- Kevin (2026-10-25): people can edit and delete their own messages, with no
-- time limit. An edit changes the text (or a photo/video caption) and marks
-- the message edited; a delete removes it for everyone. Logged-run, workout
-- and adjustment cards stay as they are. Reports keep their own snapshot, and
-- a deleted message's files stay while an open report points at them.

alter table messages add column if not exists edited_at timestamptz;

-- Messages stay immutable to clients except through edit_message, which sets
-- app.message_edit for its own transaction only.
create or replace function guard_message_immutable_content() returns trigger
language plpgsql set search_path = public, pg_temp as $$
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

create or replace function edit_message(p_message uuid, p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m messages;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  select * into m from messages where id = p_message;
  if not found or m.from_user_id is distinct from auth.uid() then
    raise exception 'you can only edit your own messages';
  end if;
  if not can_post_thread(m.thread_id) then raise exception 'this conversation is read-only'; end if;
  if m.kind not in ('text', 'image', 'video') then raise exception 'that message can''t be edited'; end if;
  if m.kind = 'text' and v_body is null then raise exception 'a message can''t be empty'; end if;
  if v_body is not distinct from m.body then return; end if;
  perform set_config('app.message_edit', 'on', true);
  update messages set body = v_body, edited_at = now() where id = p_message;  -- language filter runs on body
  perform set_config('app.message_edit', 'off', true);
end;
$$;
revoke all on function edit_message(uuid, text) from public, anon;
grant execute on function edit_message(uuid, text) to authenticated;

create or replace function delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from messages where id = p_message and from_user_id = auth.uid();
  if not found then raise exception 'you can only delete your own messages'; end if;
end;
$$;
revoke all on function delete_message(uuid) from public, anon;
grant execute on function delete_message(uuid) to authenticated;

-- chat-images files nothing points at any more (a deleted photo or video's
-- preview, or an upload that never became a message), minus anything an open
-- report still points at. Swept by purge-chat-videos.
create or replace function orphan_chat_images(p_older_than interval default '1 day', p_limit int default 500)
returns table (name text)
language sql stable set search_path = public, storage, pg_temp as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-images' and o.created_at < now() - p_older_than
    and not exists (select 1 from public.messages m
                    where (m.kind = 'image' and m.payload->>'path' = o.name)
                       or (m.kind = 'video' and m.payload->>'poster' = o.name))
    and not exists (select 1 from public.content_reports r
                    where r.status = 'open'
                      and (r.content_snapshot->'payload'->>'path' = o.name
                           or r.content_snapshot->'payload'->>'poster' = o.name))
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function orphan_chat_images(interval, int) from public, anon, authenticated;
grant execute on function orphan_chat_images(interval, int) to service_role;
