-- Directory search for the assistant-coach picker. profiles RLS only exposes the
-- caller's own + linked profiles, so this definer function returns coach display
-- fields for name matches. Exposes nothing beyond id/name/title/initials.
create or replace function search_coaches(p_query text)
returns table (id uuid, name text, title coach_title, initials text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.title, p.initials
  from profiles p
  where p.role = 'coach'
    and p.name ilike '%' || p_query || '%'
  order by p.name
  limit 20;
$$;

revoke all on function search_coaches(text) from public;
revoke execute on function search_coaches(text) from anon;
grant execute on function search_coaches(text) to authenticated;
