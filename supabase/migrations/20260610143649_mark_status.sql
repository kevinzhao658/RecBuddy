-- Athletes mark their own workouts complete (or undo) without being able to
-- rewrite the plan. Definer rights perform the write; we restrict to the
-- caller's own workout and to the status column only.
create or replace function mark_workout_status(p_workout_id uuid, p_status workout_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('done', 'planned') then
    raise exception 'status % is not athlete-settable', p_status;
  end if;

  update workouts
  set status = p_status
  where id = p_workout_id
    and athlete_id = auth.uid();

  if not found then
    raise exception 'workout not found or not yours';
  end if;
end;
$$;

revoke all on function mark_workout_status(uuid, workout_status) from public;
grant execute on function mark_workout_status(uuid, workout_status) to authenticated;
