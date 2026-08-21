/** One colored slice of the done bar plus its legend entry. */
export interface StatSegment { label: string; value: number; tint: string }

/** A labeled completed-vs-planned bar used in the plan toolbar — an uppercase
 *  label with the % on the right, a "done / planned" figure, and a slim bar.
 *  The actual (done) figure stays activated; the planned total is faded.
 *  Omit `plannedText` for a DONE-ONLY stat (cross volume — there is no
 *  projected total): the figure stands alone, the % hides, and the bar
 *  becomes a full-width composition split across `segments`.
 *  Pass `segments` to color-code the done fill by sport; non-zero segments
 *  also render as a small legend under the bar.
 *  Shared by the week and month KPI rows so the two views read identically. */
export function ProgressStat({ label, done, planned, doneText, plannedText, tint, segments, legend = true }: {
  label: string; done: number; planned: number; doneText: string; plannedText?: string; tint: string
  segments?: StatSegment[]
  /** Hide the per-segment legend (when a sibling stat already shows it). */
  legend?: boolean
}) {
  const doneOnly = plannedText == null
  const pct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0
  // Done-only bars are compositions: the full width divides by share of done.
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
          shown.map((s) => (
            <div key={s.label} className={`h-full ${s.tint}`}
              style={{ width: `${(s.value / done) * span}%` }} />
          ))
        ) : (
          <div className={`h-full rounded-full ${tint}`} style={{ width: `${span}%` }} />
        )}
      </div>
      {legend && shown.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
          {shown.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-[10px] text-text-faint">
              <span className={`h-1.5 w-1.5 rounded-full ${s.tint}`} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
