export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="rb-surface2 fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[14px] border border-line px-4 py-2 text-sm text-text shadow-[0_2px_8px_rgba(0,0,0,0.45),0_14px_30px_rgba(0,0,0,0.4)]">
      {message}
    </div>
  )
}
