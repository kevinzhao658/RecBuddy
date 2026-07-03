import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { UnitProvider } from '../../lib/useUnit'
import { WorkoutResults } from './WorkoutResults'
import * as actualsMod from '../../lib/queries/actuals'
import type { Workout } from '../../lib/types'

const workout: Workout = {
  id: 'w1', plan_id: 'p1', athlete_id: 'a1', date: '2026-07-03', type: 'easy',
  title: 'Easy Run', dist: 4, pace: '7:30/mi', est_minutes: null, dur: null,
  note: 'Keep it relaxed.', sets: [['Warm-up', '1 mi easy']], status: 'done',
}

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UnitProvider>{ui}</UnitProvider>
    </QueryClientProvider>,
  )
}

test('defaults to the athlete results and toggles to the read-only plan', () => {
  vi.spyOn(actualsMod, 'useActual').mockReturnValue({
    data: { id: 'act1', workout_id: 'w1', athlete_id: 'a1', dist: 4.2, pace: '7:15/mi', time: '30:27', hr: 151, feel: 5, note: 'Legs were heavy.', source: 'manual', recorded_at: '2026-07-03T17:00:00Z' },
    isLoading: false,
  } as any)
  wrap(<WorkoutResults workout={workout} onClose={() => {}} />)

  // Results by default: logged stats + effort + athlete comment
  expect(screen.getByText('30:27')).toBeInTheDocument()
  expect(screen.getByText(/hard effort/i)).toBeInTheDocument()
  expect(screen.getByText('Legs were heavy.')).toBeInTheDocument()

  // Toggle to Plan: prescription rendered via locked WorkoutFields
  fireEvent.click(screen.getByRole('button', { name: /plan/i }))
  expect(screen.getByLabelText('Phase 1 label')).toHaveValue('Warm-up')
  expect(screen.getByLabelText('Note')).toHaveValue('Keep it relaxed.')
  expect(screen.getByLabelText('Title')).toBeDisabled()
  expect(screen.getByText(/can't be edited/i)).toBeInTheDocument()
})

test('shows a quiet empty state when the athlete logged no details', () => {
  vi.spyOn(actualsMod, 'useActual').mockReturnValue({ data: null, isLoading: false } as any)
  wrap(<WorkoutResults workout={workout} onClose={() => {}} />)
  expect(screen.getByText(/without logged details/i)).toBeInTheDocument()
})
