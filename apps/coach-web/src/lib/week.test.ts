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

// ── Training-block week math ──────────────────────────────────────────────
import { blockWeekOf, blockWeeks, blockLabel, fmtDayDate } from './week'

test('blockWeekOf counts 1-based weeks from the Monday of the start date', () => {
  expect(blockWeekOf('2026-06-29', '2026-06-29')).toBe(1)   // start monday itself
  expect(blockWeekOf('2026-06-29', '2026-07-01')).toBe(1)   // start mid-week -> same week
  expect(blockWeekOf('2026-07-06', '2026-06-29')).toBe(2)
  expect(blockWeekOf('2026-06-22', '2026-06-29')).toBe(0)   // week before the block
})

test('blockWeeks spans start through the week containing the goal', () => {
  expect(blockWeeks('2026-06-29', '2026-09-20')).toBe(12)   // Sun race, 12th week
  expect(blockWeeks('2026-06-29', '2026-06-30')).toBe(1)    // same week -> 1
})

test('blockLabel follows the viewed week and clamps at the edges', () => {
  expect(blockLabel('2026-07-06', '2026-06-29', '2026-09-20')).toBe('Week 2 of 12')
  expect(blockLabel('2026-06-22', '2026-06-29', '2026-09-20')).toBe('Starts Jun 29')
  expect(blockLabel('2026-10-05', '2026-06-29', '2026-09-20')).toBe('Week 12 of 12')
  expect(blockLabel('2026-07-06', null, '2026-09-20')).toBeNull()
})

test('fmtDayDate prefixes the weekday', () => {
  expect(fmtDayDate('2026-08-23')).toBe('Sun, Aug 23')
  expect(fmtDayDate('2026-07-13')).toBe('Mon, Jul 13')
})
