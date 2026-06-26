// Change a user's auth email correctly (updates auth.users + auth.identities via
// the Admin API; the DB trigger then syncs profiles.email).
// Usage: npm run set-email -- <currentEmail> <newEmail>
import { createClient } from '@supabase/supabase-js'

async function main() {
  const [currentEmail, newEmail] = process.argv.slice(2)
  if (!currentEmail || !newEmail) {
    console.error('Usage: npm run set-email -- <currentEmail> <newEmail>')
    process.exit(1)
  }
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr
  const user = data.users.find((u) => u.email === currentEmail)
  if (!user) {
    console.error(`No user found with email ${currentEmail}`)
    process.exit(1)
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log(`✓ auth email updated: ${currentEmail} -> ${newEmail}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
