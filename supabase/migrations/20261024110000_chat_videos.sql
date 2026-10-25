-- Chat videos, part 2: storage, expiry, and server-side checks.
-- Videos live in a private chat-videos bucket for 7 days (purged by
-- purge-chat-videos); posters live in chat-images and are kept. Read rules
-- match photos exactly: a member who can read the message, minus blocks and
-- the joined-at cutoff.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-videos', 'chat-videos', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table messages add column if not exists expires_at timestamptz;
alter table messages add column if not exists media_purged_at timestamptz;
create index if not exists messages_video_path_idx on messages ((payload->>'path')) where kind = 'video';
create index if not exists messages_video_poster_idx on messages ((payload->>'poster')) where kind = 'video';
create index if not exists messages_video_expiry_idx on messages (expires_at)
  where kind = 'video' and media_purged_at is null;

-- The server decides when a video expires and checks what the client sent.
create or replace function video_message_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_dur numeric; v_w numeric; v_h numeric;
  v_path text := new.payload->>'path';
  v_poster text := new.payload->>'poster';
  v_prefix text := new.thread_id::text || '/';
begin
  if new.kind <> 'video' then
    new.expires_at := null;
    return new;
  end if;
  new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
  new.media_purged_at := null;
  begin
    v_dur := (new.payload->>'duration_s')::numeric;
    v_w := (new.payload->>'w')::numeric;
    v_h := (new.payload->>'h')::numeric;
  exception when others then
    raise exception 'that video is missing its details';
  end;
  if v_dur is null or v_dur < 0 or v_dur > 60 then raise exception 'videos can be up to 60 seconds'; end if;
  if v_w is null or v_h is null or v_w <= 0 or v_h <= 0 then raise exception 'that video is missing its size'; end if;
  if v_path is null or left(v_path, length(v_prefix)) <> v_prefix or v_path like '%..%' then
    raise exception 'that video isn''t in this conversation';
  end if;
  if v_poster is not null and (left(v_poster, length(v_prefix)) <> v_prefix or v_poster like '%..%') then
    raise exception 'that video isn''t in this conversation';
  end if;
  return new;
end;
$$;
drop trigger if exists video_message_guard on messages;
create trigger video_message_guard before insert on messages
  for each row execute function video_message_guard();

-- Clients never change expiry or purge state (the purge job uses the service role).
create or replace function video_expiry_locked() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then
    new.expires_at := old.expires_at;
    new.media_purged_at := old.media_purged_at;
  end if;
  return new;
end;
$$;
drop trigger if exists video_expiry_locked on messages;
create trigger video_expiry_locked before update on messages
  for each row execute function video_expiry_locked();

-- Storage: same shape as chat_images_* in 20261019130000_conversations.sql.
drop policy if exists "chat_videos_select" on storage.objects;
drop policy if exists "chat_videos_insert" on storage.objects;
create policy "chat_videos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-videos'
    and (owner = auth.uid()
         or exists (select 1 from public.messages m
                    where m.kind = 'video' and m.payload->>'path' = storage.objects.name
                      and m.thread_id::text = (storage.foldername(storage.objects.name))[1]
                      and not public.has_blocked(auth.uid(), m.from_user_id)
                      and public.can_read_message(m.thread_id, m.created_at)))
  );
create policy "chat_videos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-videos'
    and not exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null)
    and exists (select 1 from public.message_threads t
                where t.id::text = (storage.foldername(name))[1] and public.can_post_thread(t.id))
  );

-- A video's poster is readable by whoever can read the video's message.
drop policy if exists "chat_images_select" on storage.objects;
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (owner = auth.uid()
         or exists (select 1 from public.messages m
                    where ((m.kind = 'image' and m.payload->>'path' = storage.objects.name)
                        or (m.kind = 'video' and m.payload->>'poster' = storage.objects.name))
                      and m.thread_id::text = (storage.foldername(storage.objects.name))[1]
                      and not public.has_blocked(auth.uid(), m.from_user_id)
                      and public.can_read_message(m.thread_id, m.created_at)))
  );

-- Who uploaded a chat video (admin-action removes a reported video only if
-- the message's sender uploaded it).
create or replace function chat_video_owner(p_path text) returns uuid
language sql stable security definer set search_path = public, storage, pg_temp as $$
  select o.owner from storage.objects o where o.bucket_id = 'chat-videos' and o.name = p_path;
$$;
revoke all on function chat_video_owner(text) from public, anon, authenticated;
grant execute on function chat_video_owner(text) to service_role;
