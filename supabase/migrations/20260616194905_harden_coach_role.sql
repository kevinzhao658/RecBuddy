-- CRITICAL fix: only actual coaches may act as / be treated as coaches.
-- (1) create_invite must be called by a profile with role='coach'.
-- (2) is_coach_of / is_head_coach_of must require the coach-side profile role='coach',
--     so a stray/injected coach_athlete row pointing at a non-coach never grants access.

create or replace function create_invite(p_athlete_name text)
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
      insert into invites (code, coach_id, athlete_name) values (v_code, auth.uid(), p_athlete_name);
      return v_code;
    exception when unique_violation then
      -- retry
    end;
  end loop;
  raise exception 'could not generate a unique invite code';
end;
$$;
revoke all on function create_invite(text) from public;
revoke execute on function create_invite(text) from anon;
grant execute on function create_invite(text) to authenticated;

create or replace function is_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca
    join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid() and p.role = 'coach'
  );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function is_head_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete ca
    join profiles p on p.id = ca.coach_id
    where ca.athlete_id = _athlete and ca.coach_id = auth.uid() and ca.relationship = 'head' and p.role = 'coach'
  );
$$ language sql stable security definer set search_path = public, pg_temp;
