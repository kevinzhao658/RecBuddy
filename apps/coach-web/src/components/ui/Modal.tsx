import type { ReactNode } from 'react'
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="rb-card w-[min(420px,90vw)] p-6" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
