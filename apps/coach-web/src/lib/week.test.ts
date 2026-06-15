import { describe, it, expect } from 'vitest'
import { addDays, mondayOf, weekDates } from './week'

describe('week helpers', () => {
  it('addDays', () => expect(addDays('2026-06-15', 7)).toBe('2026-06-22'))
  it('mondayOf a Wednesday', () => expect(mondayOf('2026-06-17')).toBe('2026-06-15')) // 2026-06-15 is a Monday
  it('weekDates returns 7 Mon..Sun', () => {
    const d = weekDates('2026-06-15')
    expect(d).toHaveLength(7); expect(d[0]).toBe('2026-06-15'); expect(d[6]).toBe('2026-06-21')
  })
})
