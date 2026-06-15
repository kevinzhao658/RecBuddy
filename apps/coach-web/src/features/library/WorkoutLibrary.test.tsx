import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { WorkoutLibrary } from './WorkoutLibrary'
import * as lib from '../../lib/queries/library'

test('lists templates and a New workout button', () => {
  vi.spyOn(lib, 'useLibrary').mockReturnValue({ data: [{ id: 'l1', type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', custom: false }], isLoading: false } as any)
  vi.spyOn(lib, 'useCreateLibraryWorkout').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  render(<QueryClientProvider client={new QueryClient()}><WorkoutLibrary /></QueryClientProvider>)
  expect(screen.getByText('Easy Run')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /new workout/i })).toBeInTheDocument()
})
