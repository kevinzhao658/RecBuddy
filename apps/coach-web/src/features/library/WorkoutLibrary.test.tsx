import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { WorkoutLibrary } from './WorkoutLibrary'
import * as lib from '../../lib/queries/library'

function setup(items: any[]) {
  const create = { mutate: vi.fn(), isPending: false }
  const update = { mutate: vi.fn(), isPending: false }
  const del = { mutate: vi.fn(), isPending: false }
  vi.spyOn(lib, 'useLibrary').mockReturnValue({ data: items, isLoading: false } as any)
  vi.spyOn(lib, 'useCreateLibraryWorkout').mockReturnValue(create as any)
  vi.spyOn(lib, 'useUpdateLibraryWorkout').mockReturnValue(update as any)
  vi.spyOn(lib, 'useDeleteLibraryWorkout').mockReturnValue(del as any)
  render(<QueryClientProvider client={new QueryClient()}><WorkoutLibrary /></QueryClientProvider>)
  return { create, update, del }
}

test('lists templates and a New workout button', () => {
  setup([{ id: 'l1', type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', custom: false, sets: [] }])
  expect(screen.getByText('Easy Run')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /new workout/i })).toBeInTheDocument()
})

test('New workout opens the full-panel editor (same view as the day editor)', () => {
  setup([])
  fireEvent.click(screen.getByRole('button', { name: /new workout/i }))
  expect(screen.getByLabelText('Title')).toBeInTheDocument()
  expect(screen.getByText('Workout structure')).toBeInTheDocument() // shared editor body
  expect(screen.getByRole('button', { name: /add to library/i })).toBeInTheDocument()
})

test('type quick-filters narrow the list to one workout type', () => {
  setup([
    { id: 'l1', type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', custom: false, sets: [] },
    { id: 'l2', type: 'tempo', title: 'My Tempo', dist: 6, pace: '8:00/mi', custom: true, sets: [] },
  ])
  expect(screen.getByText('Easy Run')).toBeInTheDocument()
  expect(screen.getByText('My Tempo')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tempo' })) // filter chip
  expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
  expect(screen.getByText('My Tempo')).toBeInTheDocument()
})

test('editing opens the workout in the editor and saves changes', () => {
  const { update } = setup([{ id: 'l1', type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', note: null, custom: false, sets: [] }])
  fireEvent.click(screen.getByRole('button', { name: /edit workout/i }))
  const title = screen.getByLabelText('Title')
  expect(title).toHaveValue('Easy Run')
  fireEvent.change(title, { target: { value: 'Easy Shakeout' } })
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
  expect(update.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'l1', patch: expect.objectContaining({ title: 'Easy Shakeout' }) }),
    expect.anything(),
  )
})

test('every workout (default or custom) exposes edit and delete', () => {
  const { del } = setup([
    { id: 'l1', type: 'easy', title: 'Built In', dist: 5, pace: '9:45/mi', custom: false, sets: [] },
    { id: 'l2', type: 'tempo', title: 'My Tempo', dist: 6, pace: '8:00/mi', custom: true, sets: [] },
  ])
  // Defaults are editable too, so both rows expose manage actions
  expect(screen.getAllByRole('button', { name: /edit workout/i })).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: /delete workout/i })).toHaveLength(2)
  // Deleting the first (default) row hits the right id
  fireEvent.click(screen.getAllByRole('button', { name: /delete workout/i })[0])
  expect(del.mutate).toHaveBeenCalledWith('l1')
})
