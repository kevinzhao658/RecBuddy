-- Athletes adjust their own race goal without gaining coach-level plan writes.
create or replace function update_my_goal(
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
  update plans
  set goal_race     = p_goal_race,
      goal_distance = p_goal_distance,
      goal_date     = p_goal_date,
      goal_time     = p_goal_time
  where athlete_id = auth.uid();

  if not found then
    raise exception 'no plan yet — your coach creates it first';
  end if;
end;
$$;

revoke all on function update_my_goal(text, text, date, text) from public;
revoke execute on function update_my_goal(text, text, date, text) from anon;
grant execute on function update_my_goal(text, text, date, text) to authenticated;
