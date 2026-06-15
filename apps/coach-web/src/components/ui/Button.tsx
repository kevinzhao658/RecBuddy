import type { ButtonHTMLAttributes } from 'react'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base = 'rounded-[12px] px-4 py-2.5 font-semibold transition disabled:opacity-50'
  const styles = variant === 'primary'
    ? 'bg-accent text-on-accent hover:brightness-105'
    : 'border border-line text-text hover:border-text-mute'
  return <button className={`${base} ${styles} ${className}`} {...p} />
}
