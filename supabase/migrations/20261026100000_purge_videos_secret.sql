-- The daily video purge authenticates with its own shared secret instead of the
-- service-role key. On prod the function's built-in service key is not the legacy
-- JWT that the gateway lets through, so every scheduled call was refused (403).
-- Set per environment: Vault purge_videos_url + purge_videos_secret, and the same
-- secret as the function's PURGE_SECRET. Without them the job does nothing.
create or replace function call_purge_chat_videos() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'purge_videos_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'purge_videos_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url,
                        headers := jsonb_build_object('x-purge-secret', v_secret, 'Content-Type', 'application/json'),
                        body := '{}'::jsonb);
end;
$$;
revoke all on function call_purge_chat_videos() from public, anon, authenticated;
