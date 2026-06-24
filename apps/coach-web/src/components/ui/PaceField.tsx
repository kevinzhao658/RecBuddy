import { Stepper, NO_SPIN, FIELD_SHELL } from './Stepper'

// Controlled pace input. The coach types digits and they fill MM:SS from the
// right — digits past the first two spill into the minutes (e.g. "730" -> 7:30,
// "1245" -> 12:45). The "/mi" unit is fixed; the ▲▼ steppers nudge by 15s.
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

// digits string ("830") <-> the {min, sec} the field displays/commits.
function partsFromDigits(d: string) {
  const min = d.length > 2 ? Number(d.slice(0, -2)) : 0
  const sec = Number(d.slice(-2) || '0')
  return { min, sec }
}
function digitsFromPace(p?: string | null): string {
  if (!p) return ''
  const m = p.match(/(\d+):(\d{1,2})/)
  if (!m) return ''
  const min = Number(m[1])
  return `${min > 0 ? min : ''}${m[2].padStart(2, '0')}`
}
const paceFromParts = (min: number, sec: number) => `${min}:${String(sec).padStart(2, '0')}/mi`

export function PaceField({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const { min, sec } = partsFromDigits(digitsFromPace(value))
  const total = paceToSeconds(value) ?? 0

  const onType = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-4)
    const p = partsFromDigits(d)
    onChange(paceFromParts(p.min, p.sec))
  }

  return (
    <div className={FIELD_SHELL}>
      <div className="flex flex-1 items-center gap-1 px-3 py-2">
        <input aria-label="Pace" inputMode="numeric" value={`${min}:${String(sec).padStart(2, '0')}`}
          onChange={(e) => onType(e.target.value)}
          className={`w-14 bg-transparent font-num text-[15px] tabular-nums text-text outline-none ${NO_SPIN}`} />
        <span className="font-num text-sm text-text-faint">/mi</span>
      </div>
      <Stepper
        onUp={() => onChange(secondsToPace(total + 15))}
        onDown={() => onChange(secondsToPace(total - 15))}
        upLabel="Increase pace by 15 seconds" downLabel="Decrease pace by 15 seconds" />
    </div>
  )
}
