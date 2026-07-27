-- Coach permission tiers on coach_athlete:
--   read  — view workouts + participate in chat (no edits)
--   edit  — create/modify workouts & the plan (+ everything read can do)
--   admin — add coaches & manage permissions (+ everything edit can do)
-- The ATHLETE is always admin over their own team (policies allow
-- athlete_id = auth.uid() directly). New coaches default to edit; the head
-- coach starts as admin, so an admin coach always exists.

-- 1. Enum + column, backfilled from the existing relationship.
create type coach_permission as enum ('read', 'edit', 'admin');
alter table coach_athlete add column if not exists permission coach_permission not null default 'edit';
update coach_athlete set permission = 'admin' where relationship = 'head';

-- 2. Permission predicates (security definer -> bypass RLS, no recursion).
create or replace function coach_can_edit(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid()
      and p.is_coach and ca.permission in ('edit', 'admin')
  );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function coach_can_admin(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid()
      and p.is_coach and ca.permission = 'admin'
  );
$$ language sql stable security definer set search_path = public, pg_temp;

-- 3. WRITES gate on edit+; reads and chat stay open to any linked coach
--    (is_coach_of) so a read coach still sees the plan and can message.
drop policy workouts_coach_write on workouts;
create policy workouts_coach_write on workouts for all
  using (coach_can_edit(athlete_id)) with check (coach_can_edit(athlete_id));

drop policy plans_write on plans;
create policy plans_write on plans for all
  using (coach_can_edit(athlete_id)) with check (coach_can_edit(athlete_id));

drop policy actuals_write on workout_actuals;
create policy actuals_write on workout_actuals for all
  using (athlete_id = auth.uid() or coach_can_edit(athlete_id))
  with check (
    (athlete_id = auth.uid() or coach_can_edit(athlete_id))
    and (
      workout_id is null
      or exists (select 1 from workouts w where w.id = workout_actuals.workout_id and w.athlete_id = workout_actuals.athlete_id)
    )
  );

-- 4. Team management (add/remove coaches, change permission): the athlete
--    themselves, or an admin coach. Replaces the head-coach-only gate.
drop policy team_write on coach_athlete;
create policy team_write on coach_athlete for all
  using (athlete_id = auth.uid() or coach_can_admin(athlete_id))
  with check (athlete_id = auth.uid() or coach_can_admin(athlete_id));

-- 5. Assign permission when a link is created: head -> admin, others -> edit.
create or replace function redeem_invite(p_code text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
  v_rel team_role;
begin
  if (select email_confirmed_at from auth.users where id = auth.uid()) is null then
    raise exception 'confirm your email before joining a coach';
  end if;
  select * into v from invites where code = p_code for update;
  if not found then raise exception 'invalid invite code'; end if;
  if v.consumed_at is not null then raise exception 'invite code already used'; end if;
  if v.expires_at is not null and v.expires_at <= now() then raise exception 'invite code expired'; end if;
  if exists (select 1 from coach_athlete where athlete_id = auth.uid() and coach_id = v.coach_id) then
    raise exception 'you''re already connected to this coach';
  end if;

  v_rel := case when exists (select 1 from coach_athlete where athlete_id = auth.uid() and relationship = 'head')
    then 'assistant'::team_role else 'head'::team_role end;

  update profiles set is_athlete = true where id = auth.uid() and not is_athlete;

  insert into coach_athlete (coach_id, athlete_id, relationship, permission)
  values (v.coach_id, auth.uid(), v_rel,
          case when v_rel = 'head' then 'admin'::coach_permission else 'edit'::coach_permission end)
  on conflict (coach_id, athlete_id) do nothing;

  insert into plans (athlete_id, goal_race, goal_distance, goal_date, goal_time, start_date)
  select auth.uid(), v.goal_race, v.goal_distance, v.goal_date, v.goal_time, v.goal_start_date
  where not exists (select 1 from plans where athlete_id = auth.uid());

  update invites set consumed_at = now(), consumed_by = auth.uid() where id = v.id;
end;
$$;

create or replace function coach_add_athlete(p_athlete_id uuid, p_relationship text default 'assistant')
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_rel team_role;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_coach) then
    raise exception 'only coaches can add athletes';
  end if;
  if p_relationship not in ('head', 'assistant') then raise exception 'invalid role'; end if;
  v_rel := p_relationship::team_role;
  if not exists (select 1 from profiles where id = p_athlete_id and is_athlete) then
    raise exception 'that account is not an athlete';
  end if;
  if v_rel = 'head' and exists (
    select 1 from coach_athlete where athlete_id = p_athlete_id and relationship = 'head' and coach_id <> auth.uid()
  ) then
    raise exception 'this athlete already has a head coach — add them as a co-coach instead';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship, permission)
  values (auth.uid(), p_athlete_id, v_rel,
          case when v_rel = 'head' then 'admin'::coach_permission else 'edit'::coach_permission end)
  on conflict (coach_id, athlete_id) do update set relationship = excluded.relationship;
end;
$$;

-- 6. update_athlete_goal now requires edit (was any coach).
create or replace function update_athlete_goal(
  p_athlete_id uuid, p_goal_race text, p_goal_distance text, p_goal_date date, p_goal_time text, p_start_date date default null)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not coach_can_edit(p_athlete_id) then
    raise exception 'you need edit access to change this athlete''s goal';
  end if;
  update plans
  set goal_race = p_goal_race, goal_distance = p_goal_distance, goal_date = p_goal_date,
      goal_time = p_goal_time, start_date = p_start_date
  where athlete_id = p_athlete_id;
  if not found then raise exception 'no plan for this athlete yet'; end if;
end;
$$;

-- 7. Change a coach's permission — the athlete or an admin coach.
create or replace function set_coach_permission(p_coach_id uuid, p_athlete_id uuid, p_permission text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not (p_athlete_id = auth.uid() or coach_can_admin(p_athlete_id)) then
    raise exception 'only the athlete or an admin coach can change permissions';
  end if;
  if p_permission not in ('read', 'edit', 'admin') then raise exception 'invalid permission'; end if;
  update coach_athlete set permission = p_permission::coach_permission
    where coach_id = p_coach_id and athlete_id = p_athlete_id;
  if not found then raise exception 'that coach is not on this athlete''s team'; end if;
end;
$$;
revoke all on function set_coach_permission(uuid, uuid, text) from public;
revoke execute on function set_coach_permission(uuid, uuid, text) from anon;
grant execute on function set_coach_permission(uuid, uuid, text) to authenticated;

-- 8. get_team surfaces permission (drives the Users management UIs).
drop function if exists get_team(uuid);
create function get_team(p_athlete_id uuid)
returns table (coach_id uuid, relationship team_role, permission coach_permission, name text, title coach_title, initials text, avatar_url text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select ca.coach_id, ca.relationship, ca.permission, p.name, p.title, p.initials, p.avatar_url
  from coach_athlete ca
  join profiles p on p.id = ca.coach_id
  where ca.athlete_id = p_athlete_id
    and (is_coach_of(p_athlete_id) or p_athlete_id = auth.uid())
  order by ca.relationship, p.name;
$$;
revoke all on function get_team(uuid) from public;
revoke execute on function get_team(uuid) from anon;
grant execute on function get_team(uuid) to authenticated;
