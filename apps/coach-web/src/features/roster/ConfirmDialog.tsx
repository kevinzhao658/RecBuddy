import { useId } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { MenuIcon, type MenuIconName } from '../../components/ui/Icon'

/** Are-you-sure card: a short question to read at a glance, then the detail
 *  in plain text. `danger` (remove, block, leave) makes the confirm red, like
 *  iOS's destructive buttons, with the action's icon above the question. */
export function ConfirmDialog({ open, title, detail, onConfirm, onCancel, confirmLabel = 'Remove', danger, icon }: {
  open: boolean; title: string; detail?: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string
  danger?: boolean; icon?: MenuIconName
}) {
  const id = useId()
  return (
    <Modal open={open} onClose={onCancel}>
      <div role="alertdialog" aria-labelledby={`${id}-t`} aria-describedby={detail ? `${id}-d` : undefined}>
        {icon && (
          <span data-testid="confirm-icon" aria-hidden
            className={`mb-4 grid h-10 w-10 place-items-center rounded-full ${danger ? 'bg-missed/15 text-missed' : 'bg-accent/15 text-accent'}`}>
            <MenuIcon name={icon} />
          </span>
        )}
        <h2 id={`${id}-t`} className="font-display text-[22px] font-bold leading-tight text-text">{title}</h2>
        {detail && <p id={`${id}-d`} className="mt-1.5 max-w-[44ch] text-sm leading-relaxed text-text-mute">{detail}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          {danger
            ? <button onClick={onConfirm}
                className="rounded-[12px] bg-missed px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:translate-y-px">{confirmLabel}</button>
            : <Button onClick={onConfirm}>{confirmLabel}</Button>}
        </div>
      </div>
    </Modal>
  )
}
