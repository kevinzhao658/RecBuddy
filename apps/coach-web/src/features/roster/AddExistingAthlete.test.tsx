import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import * as roster from '../../lib/queries/roster'
import { AddExistingAthlete } from './AddExistingAthlete'

vi.mock('../../lib/queries/roster', () => ({ useSearchAthletes: vi.fn(), useAddExistingAthlete: vi.fn() }))

const hit = (over = {}) => ({ id: 'ath-1', name: 'Jordan Lee', initials: 'JL', avatar_url: null, already_on_roster: false, ...over })
const searchMutate = vi.fn((_q, opts) => opts.onSuccess([hit()]))
const addMutate = vi.fn()

beforeEach(() => {
  searchMutate.mockClear(); addMutate.mockClear()
  vi.mocked(roster.useSearchAthletes).mockReturnValue({ mutate: searchMutate, isPending: false } as any)
  vi.mocked(roster.useAddExistingAthlete).mockReturnValue({ mutate: addMutate, isPending: false } as any)
})

test('searches by name/email and adds the picked athlete as co-coach by default', async () => {
  const onAdded = vi.fn()
  render(<AddExistingAthlete onAdded={onAdded} />)
  fireEvent.change(screen.getByLabelText('Search athletes'), { target: { value: 'jordan' } })
  expect(searchMutate).toHaveBeenCalled()
  const result = await screen.findByText('Jordan Lee')
  fireEvent.click(result)
  fireEvent.click(screen.getByRole('button', { name: /Add Jordan/ }))
  expect(addMutate).toHaveBeenCalledWith({ athleteId: 'ath-1', relationship: 'assistant' }, expect.anything())
})

test('lets the coach choose the head role', async () => {
  render(<AddExistingAthlete onAdded={() => {}} />)
  fireEvent.change(screen.getByLabelText('Search athletes'), { target: { value: 'jordan' } })
  fireEvent.click(await screen.findByText('Jordan Lee'))
  fireEvent.click(screen.getByRole('button', { name: 'Head coach' }))
  fireEvent.click(screen.getByRole('button', { name: /Add Jordan/ }))
  expect(addMutate).toHaveBeenCalledWith({ athleteId: 'ath-1', relationship: 'head' }, expect.anything())
})

test('an athlete already on the roster cannot be picked', async () => {
  searchMutate.mockImplementationOnce((_q, opts) => opts.onSuccess([hit({ already_on_roster: true })]))
  render(<AddExistingAthlete onAdded={() => {}} />)
  fireEvent.change(screen.getByLabelText('Search athletes'), { target: { value: 'jordan' } })
  await waitFor(() => expect(screen.getByText('On your roster')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /Jordan Lee/ })).toBeDisabled()
})
