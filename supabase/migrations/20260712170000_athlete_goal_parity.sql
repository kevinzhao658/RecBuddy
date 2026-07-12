-- Athlete goal editing reaches parity with the coach's editor (training-block
-- start date), and plan edits stream live to the other side.

-- Plans join the realtime publication so a goal edit on either side reflects
-- on the other without a reload (workouts + messages are already streamed).
alter publication supabase_realtime add table plans;

-- update_my_goal gains the start date (new signature -> drop + recreate).
-- COALESCE preserves the stored start when older clients omit the param —
-- an old app build must not null out the training block.
drop function if exists update_my_goal(text, text, date, text);

create function update_my_goal(
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
  update plans
  set goal_race     = p_goal_race,
      goal_distance = p_goal_distance,
      goal_date     = p_goal_date,
      goal_time     = p_goal_time,
      start_date    = coalesce(p_start_date, start_date)
  where athlete_id = auth.uid();

  if not found then
    raise exception 'no plan yet — your coach creates it first';
  end if;
end;
$$;

revoke all on function update_my_goal(text, text, date, text, date) from public;
revoke execute on function update_my_goal(text, text, date, text, date) from anon;
grant execute on function update_my_goal(text, text, date, text, date) to authenticated;
