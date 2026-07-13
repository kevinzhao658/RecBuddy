-- Coaches adjust an athlete's race goal from the athlete settings sheet.
-- Mirror of update_my_goal, but keyed on the passed athlete and gated on the
-- coaching relationship (is_coach_of already requires the coach-side profile
-- to hold role='coach').
create or replace function update_athlete_goal(
  p_athlete_id    uuid,
  p_goal_race     text,
  p_goal_distance text,
  p_goal_date     date,
  p_goal_time     text
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
      goal_time     = p_goal_time
  where athlete_id = p_athlete_id;

  if not found then
    raise exception 'no plan for this athlete yet';
  end if;
end;
$$;

revoke all on function update_athlete_goal(uuid, text, text, date, text) from public;
revoke execute on function update_athlete_goal(uuid, text, text, date, text) from anon;
grant execute on function update_athlete_goal(uuid, text, text, date, text) to authenticated;
