import { useState } from 'react'
import { useObjectUrl } from '../../lib/useObjectUrl'
import type { StagedVideo } from '../../lib/queries/chat'
import { fmtClipLength } from '../../lib/videoFile'
import { thumbSize } from '../../lib/thumbSize'

/** A video waiting to send: its first frame, length and ✕. Clicking the frame
 *  plays it above the composer at the size it'll have in the chat. */
export function StagedVideoTile({ video, onRemove }: { video: StagedVideo; onRemove: () => void }) {
  const [previewing, setPreviewing] = useState(false)
  const src = useObjectUrl(video.file)
  const poster = useObjectUrl(video.poster)

  return (
    <div className="flex shrink-0 flex-col items-start gap-2">
      {previewing && src && (
        <video data-testid="staged-preview" src={src} controls autoPlay playsInline
          style={thumbSize(video.w, video.h)} className="rounded-[14px] bg-black object-contain [&:fullscreen]:object-contain" />
      )}
      <div className="relative h-16 w-16">
        <button type="button" onClick={() => setPreviewing((p) => !p)} aria-label={previewing ? 'Hide preview' : 'Preview video'}
          className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-[10px] bg-surface2 ring-1 ring-line transition hover:ring-text-mute">
          {poster && <img src={poster} alt="Attached video" className="absolute inset-0 h-full w-full object-cover" />}
          <span aria-hidden className="relative grid h-7 w-7 place-items-center rounded-full bg-black/55 text-xs text-white">
            {previewing ? '■' : '▶'}
          </span>
          <span className="absolute bottom-1 right-1 rounded-[6px] bg-black/60 px-1 font-num text-[10px] text-white">{fmtClipLength(video.duration)}</span>
        </button>
        <button type="button" aria-label="Remove video" onClick={onRemove}
          className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-surface2 text-xs text-text ring-1 ring-line hover:text-missed">✕</button>
      </div>
    </div>
  )
}
