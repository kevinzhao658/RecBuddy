-- Lets the sign-in screens say "we couldn't find an account" before sending a
-- password-reset email: Supabase's /recover silently succeeds for unknown
-- addresses. Anon-callable by design. It reveals only whether an email is
-- registered, which signup already discloses (coach-signup and the athlete
-- invite flow both report "already registered").
create function email_has_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
  );
$$;

revoke all on function email_has_account(text) from public;
grant execute on function email_has_account(text) to anon, authenticated;
