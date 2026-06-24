// Shared ▲▼ stepper column used by every numeric field (pace, distance, …) so
// the click targets and styling are identical everywhere.
export function Stepper({ onUp, onDown, upLabel, downLabel }: {
  onUp: () => void; onDown: () => void; upLabel: string; downLabel: string
}) {
  const btn = 'flex flex-1 items-center px-2 text-[11px] leading-none text-text-faint transition hover:bg-surface hover:text-text'
  return (
    <div className="flex flex-col border-l border-line">
      <button type="button" aria-label={upLabel} onClick={onUp} className={btn}>▲</button>
      <button type="button" aria-label={downLabel} onClick={onDown} className={`${btn} border-t border-line`}>▼</button>
    </div>
  )
}

export const NO_SPIN = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
export const FIELD_SHELL = 'flex items-stretch overflow-hidden rounded-[10px] border border-line bg-surface2 focus-within:border-text-mute'
