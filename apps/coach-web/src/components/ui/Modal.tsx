import { useRef, type ReactNode } from 'react'

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  // Only close on a genuine backdrop click — i.e. the press STARTED on the
  // backdrop. Prevents a text-drag that begins inside an input and releases on
  // the backdrop from closing the modal.
  const downOnBackdrop = useRef(false)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose() }}>
      <div className="rb-card w-[min(420px,90vw)] p-6" onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
