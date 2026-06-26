import { useEffect, useRef } from 'react'

// Cloudflare Turnstile. Defaults to Cloudflare's public TEST site key (always
// passes) so signup works in dev with no setup; set VITE_TURNSTILE_SITE_KEY to
// your real key for prod. https://developers.cloudflare.com/turnstile/
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void } }
}

/** Renders the Turnstile widget; calls onToken('') until solved, then with the token. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const cbRef = useRef(onToken)
  cbRef.current = onToken

  useEffect(() => {
    let widgetId: string | null = null
    let poll: ReturnType<typeof setInterval> | undefined

    const render = () => {
      if (!boxRef.current || !window.turnstile || widgetId) return
      widgetId = window.turnstile.render(boxRef.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => cbRef.current(t),
        'error-callback': () => cbRef.current(''),
        'expired-callback': () => cbRef.current(''),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      if (!document.getElementById(SCRIPT_ID)) {
        const s = document.createElement('script')
        s.id = SCRIPT_ID; s.src = SCRIPT_SRC; s.async = true; s.defer = true
        document.head.appendChild(s)
      }
      poll = setInterval(() => { if (window.turnstile) { clearInterval(poll); render() } }, 150)
    }

    return () => {
      if (poll) clearInterval(poll)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  return <div ref={boxRef} />
}
