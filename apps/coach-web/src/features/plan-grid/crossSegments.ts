import type { CrossDoneBySport } from '../../lib/volume'
import type { StatSegment } from '../../components/ui/ProgressStat'

/** Color-coded slices of the cross volume bar, one per sport. Bike keeps the
 *  accent (it's the cross default); swim and run get distinct tints. Zero
 *  segments are filtered by ProgressStat, so run-free weeks show two slices. */
export function crossSegments(c: CrossDoneBySport): StatSegment[] {
  return [
    { label: 'Bike', value: c.ride, tint: 'bg-accent' },
    { label: 'Swim', value: c.swim, tint: 'bg-sky-400' },
    { label: 'Run', value: c.run, tint: 'bg-amber-400' },
  ]
}
