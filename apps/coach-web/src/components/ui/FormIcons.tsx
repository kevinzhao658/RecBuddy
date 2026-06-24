/** Small inline form glyphs (stroke, currentColor) used in labeled inputs. */
type P = { className?: string }
const base = 'h-4 w-4'

export function MailIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
    </svg>
  )
}
export function LockIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
export function UserIcon({ className = '' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  )
}
export function GoogleIcon({ className = '' }: P) {
  // Multi-color Google G (keeps brand colors; intentional exception to the mono palette).
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c5.6 0 9.3-3.9 9.3-9.4 0-.6-.07-1.1-.16-1.6H12z" />
    </svg>
  )
}
