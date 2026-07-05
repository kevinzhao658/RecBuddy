import { useMemo } from 'react'
import { Wordmark } from '../components/ui/Wordmark'
import { Button } from '../components/ui/Button'

// Inline lime check icon (no emoji — house rule)
function CheckIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="rgba(173,255,47,0.14)" />
      <circle cx="24" cy="24" r="18" fill="rgba(173,255,47,0.18)" />
      <path
        d="M14 24l7 7 13-13"
        stroke="#ADFF2F"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// Inline error icon (no emoji — house rule)
function ErrorIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="rgba(255,90,82,0.12)" />
      <circle cx="24" cy="24" r="18" fill="rgba(255,90,82,0.16)" />
      <path d="M24 16v10" stroke="#FF5A52" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="31" r="1.5" fill="#FF5A52" />
    </svg>
  )
}

/** Parses Supabase error fragments from window.location.hash.
 *  Supabase appends #error=...&error_description=... on failures. */
function parseHashError(): { error: string; description: string } | null {
  const hash = window.location.hash.slice(1) // strip leading '#'
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const error = params.get('error')
  if (!error) return null
  return {
    error,
    description: decodeURIComponent((params.get('error_description') ?? '').replace(/\+/g, ' ')),
  }
}

/** Public landing page for athlete email-confirmation links.
 *  No auth required — never wrap in RequireCoach or RedirectIfCoach. */
export default function ConfirmedPage() {
  const err = useMemo(() => parseHashError(), [])

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="w-full max-w-[380px]">
        <Wordmark className="text-3xl" />

        {err ? (
          /* ── Error state ──────────────────────────────────────────── */
          <>
            <div className="mt-8 flex justify-center">
              <ErrorIcon />
            </div>
            <h2 className="mt-5 text-center text-[26px] font-bold tracking-tight">
              This link is invalid or has expired
            </h2>
            {err.description && (
              <p className="mt-2 text-center text-[15px] text-missed">{err.description}</p>
            )}
            <p className="mt-4 text-center text-[15px] text-text-mute">
              Head back to the RecBuddy app on your phone and request a new confirmation email.
            </p>
          </>
        ) : (
          /* ── Success state ────────────────────────────────────────── */
          <>
            <div className="mt-8 flex justify-center">
              <CheckIcon />
            </div>
            <h2 className="mt-5 text-center text-[26px] font-bold tracking-tight">
              Email confirmed
            </h2>
            <p className="mt-2 text-center text-[15px] text-text-mute">
              Your RecBuddy account is ready. Head back to the app on your phone and sign in.
            </p>
            <a href="recbuddy://confirmed" className="mt-6 block">
              <Button className="w-full">Open the RecBuddy app</Button>
            </a>
            <p className="mt-3 text-center text-sm text-text-faint">
              On your phone, this opens the app directly.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
