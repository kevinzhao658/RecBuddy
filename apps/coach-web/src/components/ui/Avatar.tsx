export function Avatar({ initials, url, className = '', size = 'md' }: {
  initials: string; url?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' | 'team'
}) {
  const dims =
    size === 'sm' ? 'h-5 w-5 rounded-full text-[10px]'
    : size === 'lg' ? 'h-14 w-14 rounded-full text-base'
    : size === 'team' ? 'h-7 w-7 rounded-full text-[11px] md:h-9 md:w-9 md:text-sm' // compact stack on phones
    : 'h-9 w-9 rounded-full text-sm'
  if (url) {
    return <img src={url} alt={initials} className={`shrink-0 object-cover ring-1 ring-hairline ${dims} ${className}`} />
  }
  return (
    <span className={`rb-surface2 grid place-items-center font-semibold tracking-tight text-text ring-1 ring-hairline ${dims} ${className}`}>
      {initials}
    </span>
  )
}
