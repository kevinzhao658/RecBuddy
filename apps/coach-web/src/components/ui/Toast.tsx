export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[14px] border border-line bg-surface2 px-4 py-2 text-sm text-text shadow-lg">
      {message}
    </div>
  )
}
