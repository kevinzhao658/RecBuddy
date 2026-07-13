import { describe, it, expect } from 'vitest'
import { estMinutes, paceToSec } from './estMinutes'

describe('estMinutes', () => {
  it('rest is 0', () => expect(estMinutes({ type: 'rest', est_minutes: null, dist: null, pace: null, dur: null } as any)).toBe(0))
  it('uses explicit override', () => expect(estMinutes({ type: 'easy', est_minutes: 40, dist: 5, pace: '9:00/mi', dur: null } as any)).toBe(40))
  it('computes dist*pace', () => expect(estMinutes({ type: 'easy', est_minutes: null, dist: 5, pace: '9:00/mi', dur: null } as any)).toBe(45))
  it('cross defaults to 45', () => expect(estMinutes({ type: 'cross', est_minutes: null, dist: null, pace: null, dur: null } as any)).toBe(45))
  it('paceToSec parses', () => expect(paceToSec('7:30/mi')).toBe(450))
})

// ── secToPace (inverse of paceToSec, for the editor's auto-calc) ───────────
import { secToPace } from './estMinutes'

test('secToPace formats seconds-per-mile as M:SS/mi', () => {
  expect(secToPace(570)).toBe('9:30/mi')
  expect(secToPace(600)).toBe('10:00/mi')
  expect(secToPace(65)).toBe('1:05/mi')
})
