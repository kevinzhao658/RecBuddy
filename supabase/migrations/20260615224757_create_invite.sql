-- Generate a unique, human-readable invite code and insert an invite row owned
-- by the calling coach. Returns the code. authenticated-only; the coach is taken
-- from auth.uid() so a coach can only create invites for themselves.
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
  for attempt in 1..10 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into invites (code, coach_id, athlete_name)
      values (v_code, auth.uid(), p_athlete_name);
      return v_code;
    exception when unique_violation then
      -- code collided; loop and try again
    end;
  end loop;
  raise exception 'could not generate a unique invite code';
end;
$$;

revoke all on function create_invite(text) from public;
revoke execute on function create_invite(text) from anon;
grant execute on function create_invite(text) to authenticated;
