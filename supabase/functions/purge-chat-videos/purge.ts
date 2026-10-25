// Deletes chat video files whose 7 days are up and marks their messages.
// No imports, so the tests can run it under Node with a service-role client.

// The slice of a supabase-js client this uses.
type Client = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: { message: string } | null }> } }
}

/** Purge in batches until nothing expired is left. Returns how many were purged.
 *  A video with an open report is skipped by expired_videos until resolved. */
export async function purgeExpiredVideos(admin: Client, batch = 500): Promise<number> {
  let total = 0
  for (;;) {
    const { data, error } = await admin.rpc('expired_videos', { p_limit: batch })
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { id: string; path: string | null }[]
    if (rows.length === 0) return total
    const paths = rows.map((r) => r.path).filter((p): p is string => !!p)
    // Removing a file that's already gone isn't an error, so those get marked too.
    if (paths.length) {
      const { error: rmErr } = await admin.storage.from('chat-videos').remove(paths)
      if (rmErr) throw new Error(rmErr.message)
    }
    const { error: markErr } = await admin.rpc('mark_videos_purged', { p_ids: rows.map((r) => r.id) })
    if (markErr) throw new Error(markErr.message)
    total += rows.length
    if (rows.length < batch) return total
  }
}
