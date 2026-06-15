import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
export function ConfirmDialog({ open, title, onConfirm, onCancel }: { open: boolean; title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="mb-4 text-lg">{title}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm}>Remove</Button>
      </div>
    </Modal>
  )
}
