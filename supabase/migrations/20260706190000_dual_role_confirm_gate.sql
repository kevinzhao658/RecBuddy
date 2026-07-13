-- Dual-role (coach AND athlete on one account) + email-confirmation gate on
-- invite redemption.
--
-- Role model: `profiles.role` stays as the PRIMARY role for display/back-compat,
-- but every permission gate moves to two independent flags — is_coach /
-- is_athlete — so one person can hold both. Flags are only ever granted
-- server-side (service role or SECURITY DEFINER RPCs), mirroring how role/title
-- were already protected.

-- 1. Flags + backfill from the current single role.
alter table profiles add column if not exists is_coach   boolean not null default false;
alter table profiles add column if not exists is_athlete boolean not null default false;
update profiles set is_coach = (role = 'coach'), is_athlete = (role = 'athlete');

-- 2. Privilege guard: the flags join role/title as service-side-only fields.
--    `postgres` is allowed too — SECURITY DEFINER functions (owned by postgres)
--    are the sanctioned in-database path for granting a role (redeem_invite).
create or replace function guard_profile_privileged_fields() returns trigger as $$
begin
  if (new.role is distinct from old.role
      or new.title is distinct from old.title
      or new.is_coach is distinct from old.is_coach
      or new.is_athlete is distinct from old.is_athlete)
     and current_user not in ('service_role', 'postgres') then
    raise exception 'role fields may only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- 3. Self-signups: athlete role as a flag too (role column unchanged).
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, is_athlete, is_coach, name, email, experience_level, primary_goal)
  values (
    new.id,
    'athlete',
    true,
    false,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    (new.raw_user_meta_data->>'experience_level')::public.athlete_level,
    (new.raw_user_meta_data->>'primary_goal')::public.athlete_goal
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 4. Permission gates: role='coach' checks become is_coach.
create or replace function is_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca
    join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid() and p.is_coach
  );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function is_head_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca
    join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid() and ca.relationship = 'head' and p.is_coach
  );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function create_invite(
  p_athlete_name  text,
  p_goal_race     text default null,
  p_goal_distance text default null,
  p_goal_date     date default null,
  p_goal_time     text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_coach) then
    raise exception 'only coaches can create invites';
  end if;
  for attempt in 1..10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into invites (code, coach_id, athlete_name, goal_race, goal_distance, goal_date, goal_time)
      values (v_code, auth.uid(), p_athlete_name, p_goal_race, p_goal_distance, p_goal_date, p_goal_time);
      return v_code;
    exception when unique_violation then
      -- code collided; retry
    end;
  end loop;
  raise exception 'could not generate a unique invite code';
end;
$$;

create or replace function search_coaches(p_query text)
returns table (id uuid, name text, title coach_title, initials text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.title, p.initials, p.avatar_url
  from profiles p
  where p.is_coach
    and p.name ilike '%' || p_query || '%'
  order by p.name
  limit 20;
$$;

-- 5. A dual-role user must never coach themselves.
alter table coach_athlete add constraint coach_athlete_no_self check (coach_id <> athlete_id);

-- 6. redeem_invite — the athlete-role choke point:
--    * requires a CONFIRMED email (the roster link is what makes the athlete
--      visible to the coach, so redemption is gated, not signup)
--    * grants is_athlete (a coach redeeming an invite becomes dual-role)
--    * refuses self-invites and a second head coach (restores the guard that
--      the invite_goal migration dropped)
--    * seeds a plan from the invite goal ONLY if none exists — a removed
--      athlete re-attaching to a new coach keeps their plan
create or replace function redeem_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
begin
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'confirm your email before joining a coach';
  end if;

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
  if v.coach_id = auth.uid() then
    raise exception 'you cannot redeem your own invite';
  end if;
  if exists (select 1 from coach_athlete where athlete_id = auth.uid() and relationship = 'head') then
    raise exception 'athlete already has a head coach';
  end if;

  update profiles set is_athlete = true where id = auth.uid() and not is_athlete;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), 'head')
  on conflict (coach_id, athlete_id) do nothing;

  insert into plans (athlete_id, goal_race, goal_distance, goal_date, goal_time)
  select auth.uid(), v.goal_race, v.goal_distance, v.goal_date, v.goal_time
  where not exists (select 1 from plans where athlete_id = auth.uid());

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;
