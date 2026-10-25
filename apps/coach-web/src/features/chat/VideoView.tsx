import { useEffect, useRef, useState } from 'react'
import type { VideoCard } from '../../lib/types'
import { useSignedImageUrl, downloadVideo } from '../../lib/queries/chat'
import { getVideo, putVideo, requestPersistence } from '../../lib/videoStore'
import { expiryLabel, videoState } from '../../lib/videoExpiry'
import { fmtClipLength } from '../../lib/videoFile'

/** A chat video: poster + play button + length. The clip is downloaded into
 *  this browser as soon as the bubble scrolls into view, so it keeps playing
 *  after the server deletes its copy (7 days). Without a copy here, an expired
 *  clip shows its poster dimmed with "Video expired". */
export function VideoView({ messageId, p, expiresAt, purgedAt }: {
  messageId: string; p: VideoCard; expiresAt: string | null | undefined; purgedAt: string | null | undefined
}) {
  const { data: posterUrl } = useSignedImageUrl(p.poster ?? null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [checked, setChecked] = useState(false)
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now()
  const state = videoState({ hasLocal: !!blob, purged: !!purgedAt, expired })

  // Is there already a copy in this browser?
  useEffect(() => {
    let live = true
    void requestPersistence()
    getVideo(messageId).then((b) => { if (live) { setBlob(b); setChecked(true) } })
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

  useEffect(() => {
    if (!checked || !visible || state !== 'remote') return
    let live = true
    downloadVideo(p.path)
      .then(async (b) => { await putVideo(messageId, b); if (live) setBlob(b) })
      .catch(() => { /* stays remote; tapping play retries */ })
    return () => { live = false }
  }, [checked, visible, state, p.path, messageId])

  useEffect(() => {
    if (!open || !blob) return
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [open, blob])

  const aspect = p.w && p.h ? { aspectRatio: `${p.w}/${p.h}` } : undefined
  const note = state === 'remote' && expiresAt ? expiryLabel(expiresAt) : null

  return (
    <div ref={ref} className="flex max-w-[70%] flex-col gap-1">
      <div style={aspect} className="relative w-56 max-w-full overflow-hidden rounded-[14px] bg-surface2">
        {posterUrl
          ? <img src={posterUrl} alt="Video" className={`h-full w-full object-cover ${state === 'expired' ? 'opacity-40' : ''}`} />
          : <div role="img" aria-label="Video" className="h-full w-full" />}
        {state === 'expired' ? (
          <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-text">Video expired</span>
        ) : (
          <button aria-label="Play video" onClick={() => setOpen(true)} disabled={!blob}
            className="absolute inset-0 grid place-items-center disabled:cursor-progress">
            <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg text-white">▶</span>
          </button>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-[6px] bg-black/60 px-1.5 font-num text-[11px] text-white">{fmtClipLength(p.duration_s)}</span>
      </div>
      {note && <span className="text-[11px] text-text-faint">{note}</span>}
      {open && (
        <div role="dialog" aria-label="Video" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
          {src && <video data-testid="video-player" src={src} controls autoPlay playsInline
            className="max-h-full max-w-full rounded-[14px]" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
    </div>
  )
}
