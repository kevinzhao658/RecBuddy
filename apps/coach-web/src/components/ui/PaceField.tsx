// Controlled pace input: the coach edits only the minutes/seconds integers; the
// "/mi" unit is fixed. The ▲▼ steppers nudge the whole pace by 15 seconds
// (rolling seconds into minutes as needed).
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

const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export function PaceField({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const total = paceToSeconds(value) ?? 0
  const min = Math.floor(total / 60)
  const sec = total % 60
  const commit = (t: number) => onChange(secondsToPace(t))

  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-line bg-surface2 px-3 py-2 focus-within:border-text-mute">
      <input aria-label="Pace minutes" inputMode="numeric" value={String(min)}
        onChange={(e) => commit(Number(e.target.value.replace(/\D/g, '').slice(0, 2) || '0') * 60 + sec)}
        className={`w-6 bg-transparent text-right font-num text-[15px] text-text outline-none ${noSpin}`} />
      <span className="font-num text-[15px] text-text">:</span>
      <input aria-label="Pace seconds" inputMode="numeric" value={String(sec).padStart(2, '0')}
        onChange={(e) => commit(min * 60 + Math.min(59, Number(e.target.value.replace(/\D/g, '').slice(-2) || '0')))}
        className={`w-7 bg-transparent font-num text-[15px] text-text outline-none ${noSpin}`} />
      <span className="font-num text-sm text-text-faint">/mi</span>
      <div className="ml-auto flex flex-col">
        <button type="button" aria-label="Increase pace by 15 seconds" onClick={() => commit(total + 15)}
          className="-mb-px text-[9px] leading-none text-text-faint hover:text-text">▲</button>
        <button type="button" aria-label="Decrease pace by 15 seconds" onClick={() => commit(total - 15)}
          className="-mt-px text-[9px] leading-none text-text-faint hover:text-text">▼</button>
      </div>
    </div>
  )
}
