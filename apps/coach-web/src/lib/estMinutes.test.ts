import { describe, it, expect } from 'vitest'
import { estMinutes, paceToSec } from './estMinutes'

describe('estMinutes', () => {
  it('rest is 0', () => expect(estMinutes({ type: 'rest', est_minutes: null, dist: null, pace: null, dur: null } as any)).toBe(0))
  it('uses explicit override', () => expect(estMinutes({ type: 'easy', est_minutes: 40, dist: 5, pace: '9:00/mi', dur: null } as any)).toBe(40))
  it('computes dist*pace', () => expect(estMinutes({ type: 'easy', est_minutes: null, dist: 5, pace: '9:00/mi', dur: null } as any)).toBe(45))
  it('cross defaults to 45', () => expect(estMinutes({ type: 'cross', est_minutes: null, dist: null, pace: null, dur: null } as any)).toBe(45))
  it('paceToSec parses', () => expect(paceToSec('7:30/mi')).toBe(450))
})
