-- Self-coaching: an athlete-coach may appear on their own roster. Reverses the
-- dual-role migration's two blockers — a coach redeeming their own invite code
-- becomes their own (head) coach, managing their plan from coach-web and
-- training against it in the athlete app.

alter table coach_athlete drop constraint if exists coach_athlete_no_self;

-- redeem_invite minus the self-invite guard (same signature -> replace).
-- All other guards stay: confirmed email, unconsumed/unexpired code, single
-- head coach, plan seeded only when none exists.
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
