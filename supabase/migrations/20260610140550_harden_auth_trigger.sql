-- Security: self-signups are ALWAYS created as athletes — role/title are never
-- taken from client-supplied metadata. Coaches are promoted by the service role
-- after creation (see the test harness / seed). This closes the privilege-
-- escalation hole regardless of GoTrue's app_metadata write timing.
-- SECURITY DEFINER with a pinned search_path; enum casts schema-qualified.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, name, email, experience_level, primary_goal)
  values (
    new.id,
    'athlete',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    (new.raw_user_meta_data->>'experience_level')::public.athlete_level,
    (new.raw_user_meta_data->>'primary_goal')::public.athlete_goal
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
