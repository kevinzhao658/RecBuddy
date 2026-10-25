import { compressImage } from './compressImage'

/** Chat video limits: the browser can't compress video well, so web clips are
 *  sent as they are, capped at 60 s and 50 MB (the bucket enforces the size). */
export const MAX_VIDEO_SECONDS = 60
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const VIDEO_TOO_BIG = 'Videos can be up to 60 seconds and 50 MB.'
const FALLBACK = { w: 1280, h: 720 }

export interface VideoMeta { duration: number; w: number; h: number }
export type VideoCheck = ({ ok: true } & VideoMeta) | { ok: false; error: string }

/** "0:42", "1:00" */
export function fmtClipLength(s: number): string {
  const sec = Math.max(0, Math.round(s))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export function isVideoFile(f: File): boolean {
  return f.type === 'video/mp4' || f.type === 'video/quicktime'
}

/** Read duration and size from the file's metadata in a hidden <video>. */
export function readVideoMeta(f: File): Promise<VideoMeta> {
  return withVideo(f, (v) => ({ duration: v.duration, w: v.videoWidth, h: v.videoHeight }))
}

/** Refuse only what's clearly over the limits. Some files (HEVC .mov in some
 *  browsers, very short clips) report no usable duration or size; those still
 *  send, with duration 0 and a 16:9 frame. */
export async function checkVideo(f: File, read: (f: File) => Promise<VideoMeta> = readVideoMeta): Promise<VideoCheck> {
  if (f.size > MAX_VIDEO_BYTES) return { ok: false, error: VIDEO_TOO_BIG }
  let meta: VideoMeta = { duration: NaN, w: 0, h: 0 }
  try { meta = await read(f) } catch { /* unreadable: send anyway */ }
  if (Number.isFinite(meta.duration) && meta.duration > MAX_VIDEO_SECONDS) return { ok: false, error: VIDEO_TOO_BIG }
  const duration = Number.isFinite(meta.duration) ? Math.round(meta.duration) : 0
  const sized = meta.w > 0 && meta.h > 0
  return { ok: true, duration, w: sized ? meta.w : FALLBACK.w, h: sized ? meta.h : FALLBACK.h }
}

/** A JPEG still from 0.5 s in, or null when the browser can't decode the clip. */
export async function posterFrame(f: File): Promise<{ blob: Blob; w: number; h: number } | null> {
  try {
    const frame = await withVideo(f, (v) => new Promise<Blob | null>((resolve) => {
      v.onseeked = () => {
        const c = document.createElement('canvas')
        c.width = v.videoWidth; c.height = v.videoHeight
        const ctx = c.getContext('2d')
        if (!ctx || !c.width) return resolve(null)
        ctx.drawImage(v, 0, 0)
        c.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
      }
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
    }))
    if (!frame) return null
    return await compressImage(new File([frame], 'poster.jpg', { type: 'image/jpeg' }))
  } catch {
    return null
  }
}

/** Load a file into a muted, detached <video> and run `read` once metadata is in. */
function withVideo<T>(f: File, read: (v: HTMLVideoElement) => T | Promise<T>, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const url = URL.createObjectURL(f)
    const v = document.createElement('video')
    v.preload = 'metadata'; v.muted = true; v.playsInline = true
    const done = () => { clearTimeout(timer); URL.revokeObjectURL(url) }
    const timer = setTimeout(() => { done(); reject(new Error('timed out reading video')) }, timeoutMs)
    v.onloadedmetadata = async () => {
      try { resolve(await read(v)) } catch (e) { reject(e) } finally { done() }
    }
    v.onerror = () => { done(); reject(new Error('could not read video')) }
    v.src = url
  })
}
