/** Small unread-count pill. Renders nothing at 0. Red for visibility on any surface. */
export function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null
  return (
    <span aria-label={`${count} unread`} className={`inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-missed px-1 text-[11px] font-bold leading-none text-white ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
