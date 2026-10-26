-- Two RPCs are open to signed-out callers. email_has_account tells anyone
-- whether an address has an account, and resolve_invite returns the coach and
-- athlete names behind an invite code. Both now count calls per client IP and
-- answer HTTP 429 past a limit, so a script can't walk an email list or guess
-- invite codes. Invite codes also switch from random() to pgcrypto's secure
-- generator.

-- ── Rate limiting ───────────────────────────────────────────────────────────
-- One row per (bucket, client, window). Only definer functions touch it.
create table if not exists public.rpc_rate_limits (
  bucket       text        not null,
  client_key   text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (bucket, client_key, window_start)
);
alter table public.rpc_rate_limits enable row level security; -- no client policies
revoke all on public.rpc_rate_limits from anon, authenticated;

-- Records one call and raises SQLSTATE PT429 (PostgREST answers HTTP 429) once
-- the caller passes p_max calls in the current p_window.
--
-- The client is keyed by cf-connecting-ip, which Cloudflare sets on hosted
-- Supabase and overwrites if a client sends it. Without it, the key is the
-- RIGHTMOST x-forwarded-for entry, which our own gateway appends. The leftmost
-- entry is whatever the client claims, so it is never used. IPv6 addresses are
-- grouped by /64 because one host usually controls a whole /64.
--
-- redeem_invite is deliberately not throttled here. It raises on a bad code,
-- and that rollback would also undo the counter. It needs a signed-in,
-- email-confirmed account, and guessing one live 8-character code from 31^8
-- (about 8.5e11) takes billions of attempts.
create or replace function public.rate_limit_hit(p_bucket text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_xff text[] := string_to_array(coalesce(v_headers->>'x-forwarded-for', ''), ',');
  v_raw text := coalesce(
    nullif(trim(v_headers->>'cf-connecting-ip'), ''),
    nullif(trim(v_xff[array_length(v_xff, 1)]), ''));
  v_key text;
  v_window timestamptz := date_bin(p_window, now(), timestamptz 'epoch');
  v_hits int;
begin
  begin
    v_key := case when family(v_raw::inet) = 6
                  then network(set_masklen(v_raw::inet, 64))::text
                  else host(v_raw::inet) end;
  exception when others then
    v_key := null;
  end;
  -- Missing or unparseable: every such caller shares one bucket.
  v_key := coalesce(v_key, 'unknown');

  insert into rpc_rate_limits (bucket, client_key, window_start, hits)
  values (p_bucket, v_key, v_window, 1)
  on conflict (bucket, client_key, window_start)
  do update set hits = rpc_rate_limits.hits + 1
  returning hits into v_hits;

  -- Keep the table small; old windows are never read again.
  delete from rpc_rate_limits where window_start < now() - interval '1 day';

  if v_hits > p_max then
    raise exception 'Too many requests. Please wait a few minutes and try again.'
      using errcode = 'PT429';
  end if;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, interval) from public, anon, authenticated;

-- ── email_has_account: 20 checks per IP per 10 minutes ──────────────────────
-- Same answer as before. Both apps treat an error as "unknown" and send the
-- reset anyway, so a throttled caller still gets Supabase's own reset limits.
create or replace function public.email_has_account(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform rate_limit_hit('email_has_account', 20, interval '10 minutes');
  return exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
  );
end;
$$;
revoke all on function public.email_has_account(text) from public;
grant execute on function public.email_has_account(text) to anon, authenticated;

-- ── resolve_invite: 30 lookups per IP per 10 minutes ────────────────────────
-- The iOS invite step looks codes up as the athlete types, so one real redeem
-- costs a handful of calls.
create or replace function public.resolve_invite(p_code text)
returns table(coach_name text, coach_initials text, athlete_name text, goal_race text,
              goal_distance text, goal_date date, goal_time text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform rate_limit_hit('resolve_invite', 30, interval '10 minutes');
  return query
    select p.name, p.initials, i.athlete_name,
           i.goal_race, i.goal_distance, i.goal_date, i.goal_time
    from invites i
    join profiles p on p.id = i.coach_id
    where i.code = p_code
      and i.consumed_at is null
      and (i.expires_at is null or i.expires_at > now());
end;
$$;
revoke all on function public.resolve_invite(text) from public;
grant execute on function public.resolve_invite(text) to anon, authenticated;

-- ── create_invite: secure random codes ──────────────────────────────────────
-- Unchanged apart from the generator. Bytes at or above 248 (8 x 31) are
-- dropped so every one of the 31 letters is equally likely.
create or replace function public.create_invite(
  p_athlete_name text,
  p_goal_race text default null,
  p_goal_distance text default null,
  p_goal_date date default null,
  p_goal_time text default null,
  p_start_date date default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_byte int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_coach) then
    raise exception 'only coaches can create invites';
  end if;
  for attempt in 1..10 loop
    v_code := '';
    while length(v_code) < 8 loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      if v_byte < 248 then
        v_code := v_code || substr(alphabet, 1 + (v_byte % 31), 1);
      end if;
    end loop;
    begin
      insert into invites (code, coach_id, athlete_name, goal_race, goal_distance, goal_date, goal_time, goal_start_date)
      values (v_code, auth.uid(), p_athlete_name, p_goal_race, p_goal_distance, p_goal_date, p_goal_time, p_start_date);
      return v_code;
    exception when unique_violation then
      -- code collided; retry
    end;
  end loop;
  raise exception 'could not generate a unique invite code';
end;
$$;
revoke all on function public.create_invite(text, text, text, date, text, date) from public;
revoke execute on function public.create_invite(text, text, text, date, text, date) from anon;
