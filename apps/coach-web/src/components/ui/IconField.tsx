import type { ReactNode } from 'react'

/** Labeled input matching the handoff: uppercase tracked label, dark inset field
 *  with a leading icon and optional trailing adornment. */
export function IconField({
  label, icon, trailing, ariaLabel, ...input
}: {
  label: string
  icon: ReactNode
  trailing?: ReactNode
  ariaLabel?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-mute">{label}</span>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-text-faint">{icon}</span>
        <input
          aria-label={ariaLabel ?? label}
          className="w-full rounded-[12px] border border-line bg-surface2 py-2.5 pl-10 pr-10 text-[15px] font-normal normal-case tracking-normal text-text placeholder:text-text-faint focus:border-accent"
          {...input}
        />
        {trailing && <span className="absolute right-3 text-text-faint">{trailing}</span>}
      </span>
    </label>
  )
}
