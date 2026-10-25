// Removes a reported message's files. No imports, so tests run it under Node.

type Client = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: unknown }> } }
}
type Msg = { thread_id: string; from_user_id: string; kind: string; payload: unknown }

/** Payload paths are written by the sender, so only a file in the message's own
 *  thread folder that the sender themselves uploaded is deleted — never one the
 *  message merely points at. Posters are photos in chat-images. */
export async function removeMessageMedia(admin: Client, m: Msg) {
  const p = (m.payload ?? {}) as { path?: unknown; poster?: unknown }
  const owned = async (ownerFn: string, path: unknown): Promise<boolean> => {
    if (typeof path !== 'string' || !path.startsWith(`${m.thread_id}/`) || path.includes('..')) return false
    const { data: owner } = await admin.rpc(ownerFn, { p_path: path })
    if (owner !== m.from_user_id) console.error('refusing to delete foreign storage path', path)
    return owner === m.from_user_id
  }
  const remove = async (bucket: string, path: string) => {
    const { error } = await admin.storage.from(bucket).remove([path])
    if (error) console.error('storage remove', error)
    return !error
  }
  const out = { photo: false, video: false, poster: false }
  if (m.kind === 'image' && await owned('chat_image_owner', p.path)) out.photo = await remove('chat-images', p.path as string)
  if (m.kind === 'video') {
    if (await owned('chat_video_owner', p.path)) out.video = await remove('chat-videos', p.path as string)
    if (await owned('chat_image_owner', p.poster)) out.poster = await remove('chat-images', p.poster as string)
  }
  return out
}
