import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
export function ConfirmDialog({ open, title, onConfirm, onCancel, confirmLabel = 'Remove' }: {
  open: boolean; title: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="mb-4 font-display text-lg font-bold">{title}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
