-- Surface each coach's avatar_url through the team RPCs so co-coaches show their
-- photo in chat and the team picker (profiles RLS still hides the raw row).
-- Adding a return column changes the function signature, so drop then recreate.

drop function if exists get_team(uuid);
create function get_team(p_athlete_id uuid)
returns table (coach_id uuid, relationship team_role, name text, title coach_title, initials text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ca.coach_id, ca.relationship, p.name, p.title, p.initials, p.avatar_url
  from coach_athlete ca
  join profiles p on p.id = ca.coach_id
  where ca.athlete_id = p_athlete_id
    and (is_coach_of(p_athlete_id) or p_athlete_id = auth.uid())
  order by ca.relationship;
$$;

revoke all on function get_team(uuid) from public;
revoke execute on function get_team(uuid) from anon;
grant execute on function get_team(uuid) to authenticated;

drop function if exists search_coaches(text);
create function search_coaches(p_query text)
returns table (id uuid, name text, title coach_title, initials text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.title, p.initials, p.avatar_url
  from profiles p
  where p.role = 'coach'
    and p.name ilike '%' || p_query || '%'
  order by p.name
  limit 20;
$$;

revoke all on function search_coaches(text) from public;
revoke execute on function search_coaches(text) from anon;
grant execute on function search_coaches(text) to authenticated;
