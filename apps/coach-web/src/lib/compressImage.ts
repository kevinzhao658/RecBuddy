/** Downscale an image File to max 1280 px on the long edge and re-compress as
 *  JPEG at quality 0.72.  Uses the browser's native canvas / createImageBitmap;
 *  not unit-testable in jsdom — verified manually in the browser. */
export async function compressImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const MAX = 1280
  const bitmap = await createImageBitmap(file)
  const { width: sw, height: sh } = bitmap
  const scale = Math.min(1, MAX / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('canvas.toBlob produced null')); return }
        resolve({ blob, w, h })
      },
      'image/jpeg',
      0.72
    )
  })
}
