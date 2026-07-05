-- Chat image messages: new kind + a PRIVATE bucket for the (client-compressed) files.
-- Path convention: <thread_id>/<uuid>.jpg — first folder segment = thread_id for
-- participant-scoped storage policies below.
alter type message_kind add value if not exists 'image';

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do update set public = false;

-- Drop old policies (public read + uid-scoped write) before replacing them.
drop policy if exists "chat_images_read"      on storage.objects;
drop policy if exists "chat_images_write_own" on storage.objects;

-- SELECT: authenticated thread participants only.
-- The first folder segment of the object name is the thread_id (cast to text).
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
    )
  );

-- INSERT: authenticated thread participants only (with check; no using clause for insert).
create policy "chat_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
    )
  );
