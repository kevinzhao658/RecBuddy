-- Chat videos: also purge files no message points at (final review, 2026-10-25).
-- expired_videos() finds files through their messages, so a file outlived its
-- message forever when the message went away first: the sender deleted their
-- account (messages cascade), a thread was deleted, or an upload succeeded but
-- the send failed. Those files go once they're older than the 7-day window.
create or replace function orphan_video_files(p_older_than interval default interval '7 days', p_limit int default 500)
returns table (name text)
language sql stable security invoker set search_path = public, storage, pg_temp as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chat-videos' and o.created_at < now() - p_older_than
    and not exists (select 1 from public.messages m where m.kind = 'video' and m.payload->>'path' = o.name)
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function orphan_video_files(interval, int) from public, anon, authenticated;
grant execute on function orphan_video_files(interval, int) to service_role;
