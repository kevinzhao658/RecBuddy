import type { ReactNode } from 'react'
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={onClose}>
      <div className="w-[min(420px,90vw)] rounded-[24px] border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}
