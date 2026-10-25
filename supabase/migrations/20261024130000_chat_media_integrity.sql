-- Chat media integrity (security review, 2026-10-25).
--   1. A message grants access only to files its own sender uploaded. Before,
--      a member could post a message pointing at another member's file and so
--      expose it to someone who couldn't see the original (e.g. a late joiner).
--      Applies to photos, videos and video posters.
--   2. A video file backs exactly one message, so a second message can't move
--      its expiry or its report hold.
--   3. Clients can't backdate a video: created_at is the server's clock, and
--      expiry is computed from it.

create or replace function video_message_guard() returns trigger
language plpgsql security definer set search_path = public, storage, pg_temp as $$
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
  if auth.uid() is not null then new.created_at := now(); end if;
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
  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'chat-videos' and o.name = v_path and o.owner = new.from_user_id) then
    raise exception 'upload the video before sending it';
  end if;
  if v_poster is not null and not exists (select 1 from storage.objects o
                 where o.bucket_id = 'chat-images' and o.name = v_poster and o.owner = new.from_user_id) then
    raise exception 'upload the video before sending it';
  end if;
  return new;
end;
$$;

drop index if exists messages_video_path_idx;
create unique index if not exists messages_video_path_uniq on messages ((payload->>'path')) where kind = 'video';

drop policy if exists "chat_videos_select" on storage.objects;
create policy "chat_videos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-videos'
    and (owner = auth.uid()
         or exists (select 1 from public.messages m
                    where m.kind = 'video' and m.payload->>'path' = storage.objects.name
                      and m.from_user_id = storage.objects.owner
                      and m.thread_id::text = (storage.foldername(storage.objects.name))[1]
                      and not public.has_blocked(auth.uid(), m.from_user_id)
                      and public.can_read_message(m.thread_id, m.created_at)))
  );

drop policy if exists "chat_images_select" on storage.objects;
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (owner = auth.uid()
         or exists (select 1 from public.messages m
                    where ((m.kind = 'image' and m.payload->>'path' = storage.objects.name)
                        or (m.kind = 'video' and m.payload->>'poster' = storage.objects.name))
                      and m.from_user_id = storage.objects.owner
                      and m.thread_id::text = (storage.foldername(storage.objects.name))[1]
                      and not public.has_blocked(auth.uid(), m.from_user_id)
                      and public.can_read_message(m.thread_id, m.created_at)))
  );
