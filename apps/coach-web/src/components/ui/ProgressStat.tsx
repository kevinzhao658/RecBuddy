/** A labeled completed-vs-planned bar used in the plan toolbar — an uppercase
 *  label with the % on the right, a "done / planned" figure, and a slim bar.
 *  The actual (done) figure stays activated; the planned total is faded.
 *  Shared by the week and month KPI rows so the two views read identically. */
export function ProgressStat({ label, done, planned, doneText, plannedText, tint }: {
  label: string; done: number; planned: number; doneText: string; plannedText: string; tint: string
}) {
  const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0
  return (
    <div className="min-w-[148px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-mute">{label}</span>
        {done > 0 && <span className="font-num text-[11px] tabular-nums text-text-faint">{pct}%</span>}
      </div>
      <div className="font-num text-sm tabular-nums">
        <span className="font-semibold text-text">{doneText}</span>
        <span className="text-text-faint"> / {plannedText}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
