-- Keep profiles.email (the display copy) in sync whenever a user's auth email
-- changes — via the dashboard, the Admin API, or the in-app email-change
-- confirmation. auth.users.email is the source of truth for login; profiles.email
-- is denormalized for display, so it must follow.
create or replace function sync_profile_email() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function sync_profile_email();
