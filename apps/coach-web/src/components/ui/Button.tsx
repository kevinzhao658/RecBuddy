import type { ButtonHTMLAttributes } from 'react'

/**
 * primary = the Volt Lime CTA: Saira Condensed 800 italic, uppercase, lime fill
 * with an accent glow (one per view). ghost = calm bordered secondary action.
 */
export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base = 'rounded-[12px] px-5 py-2.5 transition active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0'
  const styles =
    variant === 'primary'
      ? 'rb-glow bg-accent text-on-accent font-display text-[15px] font-extrabold italic uppercase tracking-[0.04em] hover:brightness-110'
      : 'border border-line text-text text-sm font-semibold hover:border-text-mute hover:bg-chip'
  return <button className={`${base} ${styles} ${className}`} {...p} />
}
