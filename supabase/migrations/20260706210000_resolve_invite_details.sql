-- Invite preview returns everything the registration wizard auto-populates:
-- the athlete's name and the goal the coach captured at invite time. The code
-- itself is the bearer secret (anon-callable stays intentional — same posture
-- as the original resolve_invite, which already exposed the coach's name).
-- Return type changes, so drop + recreate.
drop function if exists resolve_invite(text);

create function resolve_invite(p_code text)
returns table (
  coach_name     text,
  coach_initials text,
  athlete_name   text,
  goal_race      text,
  goal_distance  text,
  goal_date      date,
  goal_time      text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.name, p.initials, i.athlete_name,
         i.goal_race, i.goal_distance, i.goal_date, i.goal_time
  from invites i
  join profiles p on p.id = i.coach_id
  where i.code = p_code
    and i.consumed_at is null
    and (i.expires_at is null or i.expires_at > now());
$$;

revoke all on function resolve_invite(text) from public;
grant execute on function resolve_invite(text) to anon, authenticated;
