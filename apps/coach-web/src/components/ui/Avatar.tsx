export function Avatar({ initials, className = '' }: { initials: string; className?: string }) {
  return <span className={`grid h-9 w-9 place-items-center rounded-full bg-surface2 text-sm font-semibold text-text ${className}`}>{initials}</span>
}
