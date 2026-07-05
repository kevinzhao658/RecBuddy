import { useState } from 'react'
import { Stepper, NO_SPIN, FIELD_SHELL } from './Stepper'
import type { Unit } from '../../lib/units'

const KM_PER_MI = 1.609344

// Controlled pace input. Canonical value is always "M:SS/mi" (seconds per mile);
// when unit='km' the field displays/edits per-km but still emits "/mi". Typed
// digits fill MM:SS from the right ("730" -> 7:30); ▲▼ nudge by 15s.
export function paceToSeconds(p?: string | null): number | null {
  if (!p) return null
  const m = p.match(/(\d+):(\d{1,2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
export function secondsToPace(s: number): string {
  const t = Math.max(0, s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}/mi`
}

export function PaceField({ value, onChange, unit = 'mi' }: { value: string | null; onChange: (v: string) => void; unit?: Unit }) {
  // Raw typed digits while editing. Without this buffer the display re-derives
  // from the canonical value after every keystroke, so an intermediate "73"
  // normalizes to "1:13" and the next digit re-parses as 11:30 (+4min bug).
  const [buffer, setBuffer] = useState<string | null>(null)
  const secPerMi = paceToSeconds(value) ?? 0
  const disp = unit === 'km' ? Math.round(secPerMi / KM_PER_MI) : secPerMi // seconds per display unit
  const min = Math.floor(disp / 60)
  const sec = disp % 60

  // Emit a display-unit second count back as a canonical "/mi" string.
  const emit = (dispTotal: number) => {
    const t = Math.max(0, dispTotal)
    onChange(secondsToPace(unit === 'km' ? Math.round(t * KM_PER_MI) : t))
  }
  const onType = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-4)
    setBuffer(d)
    const m = d.length > 2 ? Number(d.slice(0, -2)) : 0
    const s = Number(d.slice(-2) || '0')
    emit(m * 60 + s)
  }
  // While typing, render the digit buffer verbatim; normalized value otherwise.
  const shown = buffer != null
    ? (buffer.length > 2 ? `${Number(buffer.slice(0, -2))}:${buffer.slice(-2)}` : buffer)
    : `${min}:${String(sec).padStart(2, '0')}`

  return (
    <div className={FIELD_SHELL}>
      <div className="flex flex-1 items-center gap-1 px-3 py-2">
        <input aria-label="Pace" inputMode="numeric" value={shown}
          onChange={(e) => onType(e.target.value)}
          onBlur={() => setBuffer(null)}
          className={`w-14 bg-transparent font-num text-[15px] tabular-nums text-text outline-none ${NO_SPIN}`} />
        <span className="font-num text-sm text-text-faint">/{unit}</span>
      </div>
      <Stepper
        onUp={() => { setBuffer(null); emit(disp + 15) }}
        onDown={() => { setBuffer(null); emit(disp - 15) }}
        upLabel="Increase pace by 15 seconds" downLabel="Decrease pace by 15 seconds" />
    </div>
  )
}
