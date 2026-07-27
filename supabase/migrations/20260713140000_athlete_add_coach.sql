-- Additional coaches, from both directions:
--   * an athlete redeems a second coach's code -> that coach joins as CO-COACH
--     (assistant); their invite goal never overrides the existing plan.
--   * a coach adds an EXISTING athlete directly (search by name/email), choosing
--     the role; the athlete's plan is shared, never overwritten.
-- Plus email matching in the coach directory search.

-- 1. redeem_invite: first coach = head (+ seeds the plan); any later coach joins
--    as assistant. The plan is still seeded only when none exists, so a
--    co-coach's invite goal can't clobber the athlete's race parameters.
create or replace function redeem_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v invites%rowtype;
  v_rel team_role;
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
  if exists (select 1 from coach_athlete where athlete_id = auth.uid() and coach_id = v.coach_id) then
    raise exception 'you''re already connected to this coach';
  end if;

  -- Head for the first coach; co-coach (assistant) for every coach after that.
  v_rel := case
    when exists (select 1 from coach_athlete where athlete_id = auth.uid() and relationship = 'head')
    then 'assistant'::team_role else 'head'::team_role end;

  update profiles set is_athlete = true where id = auth.uid() and not is_athlete;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (v.coach_id, auth.uid(), v_rel)
  on conflict (coach_id, athlete_id) do nothing;

  -- Seed the plan ONLY when the athlete has none — additional coaches never
  -- overwrite an existing race goal / parameters.
  insert into plans (athlete_id, goal_race, goal_distance, goal_date, goal_time, start_date)
  select auth.uid(), v.goal_race, v.goal_distance, v.goal_date, v.goal_time, v.goal_start_date
  where not exists (select 1 from plans where athlete_id = auth.uid());

  update invites
  set consumed_at = now(), consumed_by = auth.uid()
  where id = v.id;
end;
$$;

-- 2. Coach directory search now matches an EXACT email as well as a name
--    substring (email is exact so it can't be used to enumerate the directory).
create or replace function search_coaches(p_query text)
returns table (id uuid, name text, title coach_title, initials text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.title, p.initials, p.avatar_url
  from profiles p
  where p.is_coach
    and (p.name ilike '%' || p_query || '%' or lower(p.email) = lower(trim(p_query)))
  order by p.name
  limit 20;
$$;

-- 3. Athlete search for the coach's "add existing athlete" flow. Coaches only
--    (non-coaches get no rows). Name is a substring match; email must be exact
--    (no address enumeration). Emails are never returned — only display fields
--    and whether the athlete is already on the caller's roster.
create or replace function search_athletes(p_query text)
returns table (id uuid, name text, initials text, avatar_url text, already_on_roster boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.initials, p.avatar_url,
         exists (select 1 from coach_athlete ca where ca.athlete_id = p.id and ca.coach_id = auth.uid())
  from profiles p
  where exists (select 1 from profiles c where c.id = auth.uid() and c.is_coach)
    and p.is_athlete
    and length(trim(p_query)) >= 2
    and (p.name ilike '%' || p_query || '%' or lower(p.email) = lower(trim(p_query)))
  order by p.name
  limit 20;
$$;
revoke all on function search_athletes(text) from public;
revoke execute on function search_athletes(text) from anon;
grant execute on function search_athletes(text) to authenticated;

-- 4. A coach adds an existing athlete to their roster, choosing the role.
--    Defaults to co-coach; 'head' is refused when another coach already heads
--    the athlete. Never touches the plan (the athlete keeps their goal).
create or replace function coach_add_athlete(p_athlete_id uuid, p_relationship text default 'assistant')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rel team_role;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_coach) then
    raise exception 'only coaches can add athletes';
  end if;
  if p_relationship not in ('head', 'assistant') then
    raise exception 'invalid role';
  end if;
  v_rel := p_relationship::team_role;

  if not exists (select 1 from profiles where id = p_athlete_id and is_athlete) then
    raise exception 'that account is not an athlete';
  end if;

  if v_rel = 'head' and exists (
    select 1 from coach_athlete where athlete_id = p_athlete_id and relationship = 'head' and coach_id <> auth.uid()
  ) then
    raise exception 'this athlete already has a head coach — add them as a co-coach instead';
  end if;

  insert into coach_athlete (coach_id, athlete_id, relationship)
  values (auth.uid(), p_athlete_id, v_rel)
  on conflict (coach_id, athlete_id) do update set relationship = excluded.relationship;
end;
$$;
revoke all on function coach_add_athlete(uuid, text) from public;
revoke execute on function coach_add_athlete(uuid, text) from anon;
grant execute on function coach_add_athlete(uuid, text) to authenticated;
