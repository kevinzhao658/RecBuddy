export function Avatar({ initials, className = '' }: { initials: string; className?: string }) {
  return <span className={`rb-surface2 grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-text ring-1 ring-hairline ${className}`}>{initials}</span>
}
