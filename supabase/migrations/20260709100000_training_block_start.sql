-- Training block start date: the block runs start_date -> goal_date, and
-- "Week x of y" is DERIVED from it (x follows the week being viewed), replacing
-- the static plan_week/plan_weeks counters (kept for back-compat fallback).

alter table plans   add column if not exists start_date date;
alter table invites add column if not exists goal_start_date date;

-- create_invite gains the start date. New trailing param = new signature, so
-- drop the old one to keep named-arg RPC resolution unambiguous.
drop function if exists create_invite(text, text, text, date, text);

create function create_invite(
  p_athlete_name  text,
  p_goal_race     text default null,
  p_goal_distance text default null,
  p_goal_date     date default null,
  p_goal_time     text default null,
  p_start_date    date default null
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

revoke all on function create_invite(text, text, text, date, text, date) from public;
revoke execute on function create_invite(text, text, text, date, text, date) from anon;
grant execute on function create_invite(text, text, text, date, text, date) to authenticated;

-- redeem_invite: seed start_date with the rest of the invite goal (same
-- signature -> create or replace; all dual-role/confirm guards preserved).
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

  insert into plans (athlete_id, goal_race, goal_distance, goal_date, goal_time, start_date)
  select auth.uid(), v.goal_race, v.goal_distance, v.goal_date, v.goal_time, v.goal_start_date
  where not exists (select 1 from plans where athlete_id = auth.uid());

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;

-- update_athlete_goal gains the start date (new signature -> drop + recreate).
drop function if exists update_athlete_goal(uuid, text, text, date, text);

create function update_athlete_goal(
  p_athlete_id    uuid,
  p_goal_race     text,
  p_goal_distance text,
  p_goal_date     date,
  p_goal_time     text,
  p_start_date    date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_coach_of(p_athlete_id) then
    raise exception 'only this athlete''s coach can update their goal';
  end if;

  update plans
  set goal_race     = p_goal_race,
      goal_distance = p_goal_distance,
      goal_date     = p_goal_date,
      goal_time     = p_goal_time,
      start_date    = p_start_date
  where athlete_id = p_athlete_id;

  if not found then
    raise exception 'no plan for this athlete yet';
  end if;
end;
$$;

revoke all on function update_athlete_goal(uuid, text, text, date, text, date) from public;
revoke execute on function update_athlete_goal(uuid, text, text, date, text, date) from anon;
grant execute on function update_athlete_goal(uuid, text, text, date, text, date) to authenticated;
