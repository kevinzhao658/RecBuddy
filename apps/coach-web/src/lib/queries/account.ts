import type { SupabaseClient } from '@supabase/supabase-js'

/** Whether an email belongs to a RecBuddy account. Checked before sending a
 *  password reset, since Supabase silently accepts unknown addresses. */
export async function emailHasAccount(client: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await client.rpc('email_has_account', { p_email: email })
  if (error) throw error
  return data as boolean
}
