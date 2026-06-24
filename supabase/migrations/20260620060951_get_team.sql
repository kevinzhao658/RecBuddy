-- The coaching team for an athlete, WITH coach display info. profiles RLS hides
-- other coaches' profiles from a coach, so a plain embed returns null for a
-- co-coach (e.g. an assistant) — crashing UIs that read coach.name/initials.
-- This SECURITY DEFINER function returns the full team, gated so only a coach
-- of the athlete (or the athlete themselves) can read it. Exposes only the
-- coach display fields (id/relationship/name/title/initials).
create or replace function get_team(p_athlete_id uuid)
returns table (coach_id uuid, relationship team_role, name text, title coach_title, initials text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ca.coach_id, ca.relationship, p.name, p.title, p.initials
  from coach_athlete ca
  join profiles p on p.id = ca.coach_id
  where ca.athlete_id = p_athlete_id
    and (is_coach_of(p_athlete_id) or p_athlete_id = auth.uid())
  order by ca.relationship;
$$;

revoke all on function get_team(uuid) from public;
revoke execute on function get_team(uuid) from anon;
grant execute on function get_team(uuid) to authenticated;
