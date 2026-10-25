-- Chat videos, part 3: daily purge. purge-chat-videos (edge function) asks
-- expired_videos() what to delete, removes the files through the Storage API
-- (a SQL delete would leave the files behind), then mark_videos_purged().

-- Both run as the caller (service_role only): guard_message_immutable_content
-- exempts current_user = service_role, which a definer function wouldn't be.

-- Expired, not yet purged, and not held by an open report.
create or replace function expired_videos(p_limit int default 500)
returns table (id uuid, path text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select m.id, m.payload->>'path'
  from messages m
  where m.kind = 'video' and m.media_purged_at is null and m.expires_at < now()
    and not exists (select 1 from content_reports r where r.message_id = m.id and r.status = 'open')
  order by m.expires_at
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function expired_videos(int) from public, anon, authenticated;
grant execute on function expired_videos(int) to service_role;

create or replace function mark_videos_purged(p_ids uuid[]) returns void
language sql security invoker set search_path = public, pg_temp as $$
  update messages set media_purged_at = now()
  where id = any(p_ids) and kind = 'video' and media_purged_at is null;
$$;
revoke all on function mark_videos_purged(uuid[]) from public, anon, authenticated;
grant execute on function mark_videos_purged(uuid[]) to service_role;

-- Daily at 03:15 UTC. The function URL and service key come from Vault
-- (secrets purge_videos_url and service_role_key, set per environment);
-- without them the job does nothing, so local stacks need no setup.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function call_purge_chat_videos() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_url text; v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'purge_videos_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(url := v_url,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
                        body := '{}'::jsonb);
end;
$$;
revoke all on function call_purge_chat_videos() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-chat-videos';
select cron.schedule('purge-chat-videos', '15 3 * * *', 'select public.call_purge_chat_videos()');
