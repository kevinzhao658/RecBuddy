export function Avatar({ initials, className = '', size = 'md' }: { initials: string; className?: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-5 w-5 rounded-[7px] text-[10px]' : 'h-9 w-9 rounded-[10px] text-sm'
  return (
    <span className={`rb-surface2 grid place-items-center font-semibold tracking-tight text-text ring-1 ring-hairline ${dims} ${className}`}>
      {initials}
    </span>
  )
}
