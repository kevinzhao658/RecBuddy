import { describe, it, expect } from 'vitest'
import { addDays, mondayOf, weekDates, firstOfMonth, addMonths, monthGridDates, fmtMonthYear } from './week'

describe('week helpers', () => {
  it('addDays', () => expect(addDays('2026-06-15', 7)).toBe('2026-06-22'))
  it('mondayOf a Wednesday', () => expect(mondayOf('2026-06-17')).toBe('2026-06-15')) // 2026-06-15 is a Monday
  it('weekDates returns 7 Mon..Sun', () => {
    const d = weekDates('2026-06-15')
    expect(d).toHaveLength(7); expect(d[0]).toBe('2026-06-15'); expect(d[6]).toBe('2026-06-21')
  })
})

describe('month helpers', () => {
  it('firstOfMonth / addMonths / fmtMonthYear', () => {
    expect(firstOfMonth('2026-06-21')).toBe('2026-06-01')
    expect(addMonths('2026-06-01', 1)).toBe('2026-07-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(fmtMonthYear('2026-06-21')).toBe('June 2026')
  })
  it('monthGridDates is Mon-first, whole weeks, covers the month', () => {
    const grid = monthGridDates('2026-06-15') // June 1 2026 is a Monday
    expect(grid.length % 7).toBe(0)
    expect(grid[0]).toBe('2026-06-01')
    expect(grid).toContain('2026-06-30')
  })
  it('pads leading days from the previous month', () => {
    const grid = monthGridDates('2026-07-10') // July 1 2026 is a Wednesday
    expect(grid[0]).toBe('2026-06-29') // Monday before July 1
    expect(grid).toContain('2026-07-31')
  })
})
