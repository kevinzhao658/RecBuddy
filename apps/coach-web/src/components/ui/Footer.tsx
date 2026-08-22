import { Link } from 'react-router-dom'

/** Slim legal footer for public pages. Not used on the /coach dashboard. */
export function Footer({ className = '' }: { className?: string }) {
  const link = 'hover:text-text-mute'
  return (
    <footer className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-6 text-xs text-text-faint ${className}`}>
      <span>© 2026 RecBuddy</span>
      <span aria-hidden="true">·</span>
      <Link to="/privacy" className={link}>Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms" className={link}>Terms</Link>
      <span aria-hidden="true">·</span>
      <Link to="/support" className={link}>Support</Link>
    </footer>
  )
}
