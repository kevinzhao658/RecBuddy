-- Stage 4: capture an athlete's goal race at invite time and prefill their plan
-- when they redeem the code.

-- 1. Goal fields carried on the invite (all optional — name stays the only
--    required field; a coach can fill the goal in later from the plan).
alter table invites add column if not exists goal_race     text;
alter table invites add column if not exists goal_distance text;   -- e.g. '13.1 mi'
alter table invites add column if not exists goal_date     date;
alter table invites add column if not exists goal_time     text;   -- e.g. '1:48:00'

-- 2. create_invite now accepts the goal fields. Drop the old single-arg version
--    so the signature is unambiguous, and keep the coach-only role gate.
drop function if exists create_invite(text);

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
  if (select role from public.profiles where id = auth.uid()) is distinct from 'coach' then
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

revoke all on function create_invite(text, text, text, date, text) from public;
revoke execute on function create_invite(text, text, text, date, text) from anon;
grant execute on function create_invite(text, text, text, date, text) to authenticated;

-- 3. redeem_invite links the athlete to the coach AND seeds a plan prefilled
--    with the goal captured on the invite (only if the athlete has none yet).
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

  -- Seed the athlete's first plan from the invite's goal (skip if one exists).
  insert into plans (athlete_id, goal_race, goal_distance, goal_date, goal_time)
  select auth.uid(), v.goal_race, v.goal_distance, v.goal_date, v.goal_time
  where not exists (select 1 from plans where athlete_id = auth.uid());

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;

revoke all on function redeem_invite(text) from public;
grant execute on function redeem_invite(text) to authenticated;
