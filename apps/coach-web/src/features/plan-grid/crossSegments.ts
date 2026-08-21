import type { CrossDoneBySport } from '../../lib/volume'
import type { StatSegment } from '../../components/ui/ProgressStat'

/** The cross sport palette, as matched text/bg pairs: bike orange, swim blue,
 *  run lime (the accent). One source of truth for every cross surface. */
export const SPORT_TEXT: Record<'run' | 'ride' | 'swim', string> = {
  ride: 'text-orange-400', swim: 'text-sky-400', run: 'text-accent',
}
export const SPORT_TINT: Record<'run' | 'ride' | 'swim', string> = {
  ride: 'bg-orange-400', swim: 'bg-sky-400', run: 'bg-accent',
}

/** Color-coded slices for cross bars (used for TIME allocation — distance
 *  proportions are misleading, swim meters vs bike miles). Zero segments are
 *  filtered by ProgressStat, so run-free weeks show two slices. */
export function crossSegments(c: CrossDoneBySport): StatSegment[] {
  return [
    { label: 'Bike', value: c.ride, tint: SPORT_TINT.ride },
    { label: 'Swim', value: c.swim, tint: SPORT_TINT.swim },
    { label: 'Run', value: c.run, tint: SPORT_TINT.run },
  ]
}
