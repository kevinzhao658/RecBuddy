// Deletes chat video files whose 7 days are up and marks their messages.
// No imports, so the tests can run it under Node with a service-role client.

// The slice of a supabase-js client this uses.
type Client = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: { message: string } | null }> } }
}

/** Purge in batches until nothing expired is left, then sweep files no message
 *  points at (sender deleted their account, failed sends) once they're older
 *  than `orphanAge`. Returns how many files were purged. A video with an open
 *  report is skipped by expired_videos until the report is resolved. */
export async function purgeExpiredVideos(admin: Client, batch = 500, orphanAge = '7 days'): Promise<number> {
  const expired = await purgeExpired(admin, batch)
  return expired + await purgeOrphans(admin, batch, orphanAge)
}

async function purgeOrphans(admin: Client, batch: number, orphanAge: string): Promise<number> {
  let total = 0
  for (;;) {
    const { data, error } = await admin.rpc('orphan_video_files', { p_older_than: orphanAge, p_limit: batch })
    if (error) throw new Error(error.message)
    const names = ((data ?? []) as { name: string }[]).map((r) => r.name)
    if (names.length === 0) return total
    const { error: rmErr } = await admin.storage.from('chat-videos').remove(names)
    if (rmErr) throw new Error(rmErr.message)
    total += names.length
    if (names.length < batch) return total
  }
}

async function purgeExpired(admin: Client, batch: number): Promise<number> {
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
