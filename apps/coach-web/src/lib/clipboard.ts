/** Clipboard helpers for chat Copy actions. */

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/** Copy an image by URL. Browsers only accept image/png in ClipboardItem, so
 *  the (JPEG) chat photo is redrawn onto a canvas and re-encoded as PNG. */
export async function copyImageToClipboard(url: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob())
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png encode failed'))), 'image/png'))
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

/** Image files from a paste event (screenshots, copied photos). */
export function imageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'))
}
