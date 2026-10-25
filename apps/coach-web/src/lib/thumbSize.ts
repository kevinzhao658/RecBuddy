/** Chat photo and video thumbnails: fit inside 240 × 320 px (iOS fits 220 × 300
 *  pt), never enlarged, so a tall phone shot doesn't take over the thread. */
const MAX_W = 240
const MAX_H = 320

export function thumbSize(w: number | null | undefined, h: number | null | undefined): { width: number; height: number } {
  const sw = w && w > 0 ? w : 4, sh = h && h > 0 ? h : 3
  const known = !!(w && h && w > 0 && h > 0)
  const scale = Math.min(MAX_W / sw, MAX_H / sh, known ? 1 : Infinity)
  return { width: Math.round(sw * scale), height: Math.round(sh * scale) }
}
