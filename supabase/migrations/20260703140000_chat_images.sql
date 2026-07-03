-- Chat image messages: new kind + a public bucket for the (client-compressed) files.
alter type message_kind add value if not exists 'image';

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat_images_read" on storage.objects;
create policy "chat_images_read" on storage.objects
  for select using (bucket_id = 'chat-images');

drop policy if exists "chat_images_write_own" on storage.objects;
create policy "chat_images_write_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);
