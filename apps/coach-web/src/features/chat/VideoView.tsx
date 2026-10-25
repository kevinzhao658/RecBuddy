import { useEffect, useRef, useState } from 'react'
import type { VideoCard } from '../../lib/types'
import { useSignedImageUrl, downloadVideo } from '../../lib/queries/chat'
import { getVideo, hasVideo, putVideo, requestPersistence } from '../../lib/videoStore'
import { expiryLabel, videoState } from '../../lib/videoExpiry'
import { fmtClipLength } from '../../lib/videoFile'

/** A chat video: poster + play button + length. The clip is downloaded into
 *  this browser as soon as the bubble scrolls into view, so it keeps playing
 *  after the server deletes its copy (7 days). Bytes are read back only when
 *  someone presses Play, so a thread full of clips doesn't fill the tab's
 *  memory. Without a copy here, an expired clip shows its poster dimmed with
 *  "Video expired". */
export function VideoView({ messageId, p, expiresAt, purgedAt }: {
  messageId: string; p: VideoCard; expiresAt: string | null | undefined; purgedAt: string | null | undefined
}) {
  const { data: posterUrl } = useSignedImageUrl(p.poster ?? null)
  const [hasLocal, setHasLocal] = useState<boolean | null>(null) // null until checked
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const [mountedAt] = useState(() => Date.now()) // a bubble's clock is read once, not every render
  const expired = !!expiresAt && new Date(expiresAt).getTime() <= mountedAt
  const state = videoState({ hasLocal: !!hasLocal, purged: !!purgedAt, expired })

  useEffect(() => {
    let live = true
    void requestPersistence()
    hasVideo(messageId).then((has) => { if (live) setHasLocal(has) })
    return () => { live = false }
  }, [messageId])

  // Start downloading once the bubble is on screen (immediately where
  // IntersectionObserver isn't available).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true) })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /** Download into this browser; resolves with the clip, or null on failure. */
  const fetchClip = async (): Promise<Blob | null> => {
    try {
      const b = await downloadVideo(p.path)
      await putVideo(messageId, b)
      setHasLocal(true)
      return b
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (hasLocal !== false || !visible || state !== 'remote') return
    void fetchClip() // a failure stays 'remote'; Play retries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocal, visible, state])

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  const play = async () => {
    setFailed(false)
    setLoading(true)
    const clip = hasLocal ? await getVideo(messageId) : null
    const b = clip ?? await fetchClip()
    setLoading(false)
    if (!b) { setFailed(true); return }
    setSrc(URL.createObjectURL(b))
  }
  const close = () => setSrc(null)

  const aspect = p.w && p.h ? { aspectRatio: `${p.w}/${p.h}` } : undefined
  const note = failed ? "Couldn't load the video — tap to try again."
    : state === 'remote' && expiresAt ? expiryLabel(expiresAt, new Date(mountedAt)) : null

  return (
    <div ref={ref} className="flex max-w-[70%] flex-col gap-1">
      <div style={aspect} className="relative w-56 max-w-full overflow-hidden rounded-[14px] bg-surface2">
        {posterUrl
          ? <img src={posterUrl} alt="Video" className={`h-full w-full object-cover ${state === 'expired' ? 'opacity-40' : ''}`} />
          : <div role="img" aria-label="Video" className="h-full w-full" />}
        {state === 'expired' ? (
          <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-text">Video expired</span>
        ) : (
          <button aria-label="Play video" onClick={() => void play()} disabled={loading}
            className="absolute inset-0 grid place-items-center disabled:cursor-progress">
            <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg text-white">
              {loading ? '…' : '▶'}
            </span>
          </button>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-[6px] bg-black/60 px-1.5 font-num text-[11px] text-white">{fmtClipLength(p.duration_s)}</span>
      </div>
      {note && <span className={`text-[11px] ${failed ? 'text-missed' : 'text-text-faint'}`}>{note}</span>}
      {src && (
        <div role="dialog" aria-label="Video" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={close} onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
          <video data-testid="video-player" src={src} controls autoPlay playsInline
            className="max-h-full max-w-full rounded-[14px]" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
