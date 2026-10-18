import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckIcon } from './FormIcons'

/** A small anchored menu. Closes on outside click, Escape, or (by default)
 *  after an item is chosen. Arrow keys move between items. */
export function Dropdown({ trigger, label, children, align = 'right', width = 'w-56' }: {
  trigger: (open: boolean) => ReactNode
  label: string
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
      if (!items.length) return
      e.preventDefault()
      const i = items.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
      items[next].focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus the checked item (or the first) so the keyboard can take over.
    const first = menu.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')
    first?.focus()
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}
        className="flex h-full items-center rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
        {trigger(open)}
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label}
          className={`rb-surface2 absolute top-[calc(100%+8px)] z-30 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-[14px] border border-line p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)]`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/** Section heading inside a Dropdown. */
export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="py-1">
      <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold text-text-faint">{title}</p>
      {children}
    </div>
  )
}

/** A checkable row: radio (one of a group) or checkbox (independent toggle). */
export function MenuItem({ checked, onSelect, children, kind = 'radio' }: {
  checked: boolean
  onSelect: () => void
  children: ReactNode
  kind?: 'radio' | 'checkbox'
}) {
  return (
    <button type="button" role={kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox'} aria-checked={checked} onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] outline-none transition hover:bg-chip focus-visible:bg-chip ${checked ? 'text-text' : 'text-text-mute'}`}>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <CheckIcon className={`h-3.5 w-3.5 shrink-0 text-accent ${checked ? '' : 'invisible'}`} />
    </button>
  )
}
