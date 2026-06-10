-- Final-review access-model fixes.

-- (1) CRITICAL: coach_athlete.team_write let any coach self-link to an arbitrary
--     athlete as 'head', bypassing the invite flow (account takeover). The
--     legitimate first-head link is created by redeem_invite (SECURITY DEFINER,
--     bypasses RLS) or the service-role seed, so no client self-insert branch is
--     needed. Restrict client writes to the athlete's existing head coach.
drop policy team_write on coach_athlete;
create policy team_write on coach_athlete for all
  using (is_head_coach_of(athlete_id))
  with check (is_head_coach_of(athlete_id));

-- (2) IMPORTANT: messages_update exists for mark-as-read, but RLS can't limit
--     columns, so a thread participant could rewrite another user's message.
--     Guard: only the `read` flag may change (service role exempt). INVOKER so
--     current_user is the caller's role.
create or replace function guard_message_immutable_content() returns trigger as $$
begin
  if (new.body is distinct from old.body
      or new.kind is distinct from old.kind
      or new.payload is distinct from old.payload
      or new.from_user_id is distinct from old.from_user_id
      or new.thread_id is distinct from old.thread_id
      or new.created_at is distinct from old.created_at)
     and current_user <> 'service_role' then
    raise exception 'only the read flag may be updated on a message';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger messages_guard_content before update on messages
  for each row execute function guard_message_immutable_content();

-- (3) IMPORTANT: an actual's workout_id (if set) must belong to the same athlete
--     as the actual, so an athlete can't pin an actual onto someone else's workout.
drop policy actuals_write on workout_actuals;
create policy actuals_write on workout_actuals for all
  using (athlete_id = auth.uid() or is_coach_of(athlete_id))
  with check (
    (athlete_id = auth.uid() or is_coach_of(athlete_id))
    and (
      workout_id is null
      or exists (
        select 1 from workouts w
        where w.id = workout_actuals.workout_id
          and w.athlete_id = workout_actuals.athlete_id
      )
    )
  );

-- (4) MINOR integrity: enforce a single head coach per athlete in redeem_invite.
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
  if exists (select 1 from coach_athlete where athlete_id = auth.uid() and relationship = 'head') then
    raise exception 'athlete already has a head coach';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), 'head')
  on conflict (coach_id, athlete_id) do nothing;

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;
