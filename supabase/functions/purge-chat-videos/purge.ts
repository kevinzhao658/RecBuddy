// Deletes chat video files whose 7 days are up and marks their messages, then
// sweeps chat files nothing points at any more (deleted messages, accounts).
// No imports, so the tests can run it under Node with a service-role client.

// The slice of a supabase-js client this uses.
type Client = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: { message: string } | null }> } }
}

/** Purge in batches until nothing expired is left, then sweep video and photo
 *  files no message points at (a deleted message, a deleted account, a failed
 *  send) once they're older than `orphanAge`. Returns how many files were
 *  purged. Anything an open report points at stays until it's resolved. */
export async function purgeExpiredVideos(admin: Client, batch = 500, orphanAge = '1 day'): Promise<number> {
  const expired = await purgeExpired(admin, batch)
  const videos = await purgeOrphans(admin, batch, orphanAge, 'orphan_video_files', 'chat-videos')
  return expired + videos + await purgeOrphans(admin, batch, orphanAge, 'orphan_chat_images', 'chat-images')
}

async function purgeOrphans(admin: Client, batch: number, orphanAge: string, fn: string, bucket: string): Promise<number> {
  let total = 0
  for (;;) {
    const { data, error } = await admin.rpc(fn, { p_older_than: orphanAge, p_limit: batch })
    if (error) throw new Error(error.message)
    const names = ((data ?? []) as { name: string }[]).map((r) => r.name)
    if (names.length === 0) return total
    const { error: rmErr } = await admin.storage.from(bucket).remove(names)
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
