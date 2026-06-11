-- redeem_invite and mark_workout_status are for authenticated users only.
-- Supabase's default privileges grant EXECUTE to anon on new public functions,
-- and `revoke all from public` does not remove those per-role grants — so revoke
-- anon explicitly. (resolve_invite intentionally remains anon-callable.)
revoke execute on function redeem_invite(text) from anon;
revoke execute on function mark_workout_status(uuid, workout_status) from anon;
