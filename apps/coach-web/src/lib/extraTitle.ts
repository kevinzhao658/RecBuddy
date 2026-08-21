import type { Actual } from './types'
import { actualActivity } from './volume'

/** 'Extra run' / 'Extra ride' / 'Extra swim' from the actual's declared
 *  activity (legacy rows fall back to pace inference in actualActivity). */
export function extraTitle(actual: Actual): string {
  const kind = actualActivity(actual)
  return kind === 'ride' ? 'Extra ride' : kind === 'swim' ? 'Extra swim' : 'Extra run'
}
