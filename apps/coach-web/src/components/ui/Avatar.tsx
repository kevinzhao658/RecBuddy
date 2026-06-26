export function Avatar({ initials, url, className = '', size = 'md' }: {
  initials: string; url?: string | null; className?: string; size?: 'sm' | 'md' | 'lg'
}) {
  const dims =
    size === 'sm' ? 'h-5 w-5 rounded-[7px] text-[10px]'
    : size === 'lg' ? 'h-14 w-14 rounded-[14px] text-base'
    : 'h-9 w-9 rounded-[10px] text-sm'
  if (url) {
    return <img src={url} alt={initials} className={`shrink-0 object-cover ring-1 ring-hairline ${dims} ${className}`} />
  }
  return (
    <span className={`rb-surface2 grid place-items-center font-semibold tracking-tight text-text ring-1 ring-hairline ${dims} ${className}`}>
      {initials}
    </span>
  )
}
