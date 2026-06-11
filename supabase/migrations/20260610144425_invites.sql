-- Per-athlete one-time invite codes a coach hands out.
create table invites (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  coach_id     uuid not null references profiles(id) on delete cascade,
  athlete_name text,
  expires_at   timestamptz,             -- null = no expiry (MVP default)
  consumed_at  timestamptz,
  consumed_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on invites (coach_id);

alter table invites enable row level security;

-- A coach manages only their own invites.
create policy invites_owner on invites for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Preview a code before the athlete has an account: returns the coach's
-- display name + initials for a valid, unconsumed, unexpired code; else 0 rows.
create or replace function resolve_invite(p_code text)
returns table (coach_name text, coach_initials text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.name, p.initials
  from invites i
  join profiles p on p.id = i.coach_id
  where i.code = p_code
    and i.consumed_at is null
    and (i.expires_at is null or i.expires_at > now());
$$;

revoke all on function resolve_invite(text) from public;
grant execute on function resolve_invite(text) to anon, authenticated;

-- The authenticated athlete links to the coach (as head) and consumes the
-- code. Definer rights bypass coach_athlete's head-only team_write policy.
create or replace function redeem_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
begin
  select * into v from invites where code = p_code for update;

  if not found then
    raise exception 'invalid invite code';
  end if;
  if v.consumed_at is not null then
    raise exception 'invite code already used';
  end if;
  if v.expires_at is not null and v.expires_at <= now() then
    raise exception 'invite code expired';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), 'head')
  on conflict (coach_id, athlete_id) do nothing;

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;

revoke all on function redeem_invite(text) from public;
grant execute on function redeem_invite(text) to authenticated;
