/** One slice of the done bar. All slices share the accent; a delimiter line
 *  divides neighbors and the label surfaces as a hover tooltip. */
export interface StatSegment { label: string; value: number; tint: string }

/** A labeled completed-vs-planned bar used in the plan toolbar — an uppercase
 *  label with the % on the right, a "done / planned" figure, and a slim bar.
 *  The actual (done) figure stays activated; the planned total is faded.
 *  Omit `plannedText` for a DONE-ONLY stat (no projection): the figure stands
 *  alone, the % hides, and the bar spans full width when anything is done.
 *  Pass `segments` to split the fill (cross time by sport): same tint, with a
 *  delimiter line between neighbors and the segment label as hover tooltip.
 *  Shared by the week and month KPI rows so the two views read identically. */
export function ProgressStat({ label, done, planned, doneText, plannedText, tint, segments }: {
  label: string; done: number; planned: number; doneText: string; plannedText?: string; tint: string
  segments?: StatSegment[]
}) {
  const doneOnly = plannedText == null
  const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0
  const span = doneOnly ? (done > 0 ? 100 : 0) : pct
  const shown = (segments ?? []).filter((s) => s.value > 0)
  return (
    <div className="min-w-[148px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-mute">{label}</span>
        {!doneOnly && done > 0 && <span className="font-num text-[11px] tabular-nums text-text-faint">{pct}%</span>}
      </div>
      <div className="font-num text-sm tabular-nums">
        <span className="font-semibold text-text">{doneText}</span>
        {plannedText && <span className="text-text-faint"> / {plannedText}</span>}
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-black/30">
        {shown.length > 0 && done > 0 ? (
          shown.map((s, i) => (
            <div key={s.label} title={s.label}
              className={`h-full ${s.tint} ${i > 0 ? 'border-l border-black/60' : ''}`}
              style={{ width: `${(s.value / done) * span}%` }} />
          ))
        ) : (
          <div className={`h-full rounded-full ${tint}`} style={{ width: `${span}%` }} />
        )}
      </div>
    </div>
  )
}
