import { Stepper, NO_SPIN, FIELD_SHELL } from './Stepper'

/** A numeric input with the shared ▲▼ stepper (e.g. distance in miles). */
export function NumberField({ value, onChange, step = 0.5, min = 0, ariaLabel, suffix }: {
  value: number | null; onChange: (v: number | null) => void
  step?: number; min?: number; ariaLabel: string; suffix?: string
}) {
  const cur = value ?? 0
  const commit = (n: number) => onChange(Math.max(min, Math.round(n * 100) / 100))
  return (
    <div className={FIELD_SHELL}>
      <div className="flex flex-1 items-center gap-1 px-3 py-2">
        <input aria-label={ariaLabel} inputMode="decimal" value={value ?? ''}
          onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); onChange(v === '' ? null : Number(v)) }}
          className={`w-full bg-transparent font-num text-[15px] text-text outline-none ${NO_SPIN}`} />
        {suffix && <span className="font-num text-sm text-text-faint">{suffix}</span>}
      </div>
      <Stepper onUp={() => commit(cur + step)} onDown={() => commit(cur - step)} upLabel={`Increase ${ariaLabel}`} downLabel={`Decrease ${ariaLabel}`} />
    </div>
  )
}
