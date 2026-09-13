import { act, renderHook } from '@testing-library/react'
import { useCooldown } from './useCooldown'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('starts unlocked', () => {
  const { result } = renderHook(() => useCooldown())
  expect(result.current.remaining).toBe(0)
})

test('counts down each second and unlocks at zero', () => {
  const { result } = renderHook(() => useCooldown())
  act(() => result.current.start(3))
  expect(result.current.remaining).toBe(3)

  act(() => { vi.advanceTimersByTime(1000) })
  expect(result.current.remaining).toBe(2)

  act(() => { vi.advanceTimersByTime(2000) })
  expect(result.current.remaining).toBe(0)
})
