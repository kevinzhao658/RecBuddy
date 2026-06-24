/** A small right-aligned label + numeric value, used in the plan toolbar stats. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-mute">{label}</div>
      <div className="font-num text-[19px] font-bold tabular-nums text-text">{value}</div>
    </div>
  )
}
