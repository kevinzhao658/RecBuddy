import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
)

// realtime-js hands back the already-open channel for a repeated topic, and
// adding listeners to it after subscribe() throws. Hooks that can mount twice
// (sidebar + page, phone drawer) each take their own topic.
let channelSeq = 0
export const uniqueTopic = (name: string) => `${name}#${++channelSeq}`
