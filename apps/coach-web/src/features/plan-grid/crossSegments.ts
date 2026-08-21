import type { CrossDoneBySport } from '../../lib/volume'
import type { StatSegment } from '../../components/ui/ProgressStat'

/** Slices for the cross TIME bar, one per sport, all in the standard accent —
 *  color is reserved for workout intensity, so sports are told apart by
 *  delimiter lines between segments plus a hover tooltip naming the sport.
 *  Zero segments are filtered by the bar components. */
export function crossSegments(c: CrossDoneBySport): StatSegment[] {
  return [
    { label: 'Bike', value: c.ride, tint: 'bg-accent' },
    { label: 'Swim', value: c.swim, tint: 'bg-accent' },
    { label: 'Run', value: c.run, tint: 'bg-accent' },
  ]
}
