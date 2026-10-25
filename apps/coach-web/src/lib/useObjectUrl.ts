import { useEffect, useState } from 'react'

/** A blob: URL for `blob`, made when mounted and revoked when it changes or the
 *  component goes. (Made in render and revoked in a cleanup, React's dev double
 *  mount revokes the URL still on screen; a <video> loading lazily then fails.) */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is an external resource tied to mount
    if (!blob) { setUrl(null); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
