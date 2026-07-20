import { render, screen, fireEvent } from '@testing-library/react'
import * as planQueries from '../../lib/queries/plan'
import * as rosterQueries from '../../lib/queries/roster'
import { AthleteSettingsModal } from './AthleteSettingsModal'

vi.mock('../../lib/queries/plan', () => ({ useUpdateAthleteGoal: vi.fn() }))
vi.mock('../../lib/queries/roster', () => ({ useRemoveAthlete: vi.fn() }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'coach-1' } } }) }))

const athlete = { id: 'ath-1', role: 'athlete', name: 'Jordan Lee', email: '', initials: 'JL' } as any
const plan = { id: 'p1', athlete_id: 'ath-1', goal_race: 'Riverside Half', goal_distance: '13.1 mi', goal_date: '2026-09-20', goal_time: '1:45:00', start_date: '2026-06-29' } as any

const updateMutate = vi.fn()
const removeMutate = vi.fn()
beforeEach(() => {
  updateMutate.mockClear(); removeMutate.mockClear()
  vi.mocked(planQueries.useUpdateAthleteGoal).mockReturnValue({ mutate: updateMutate, isPending: false } as any)
  vi.mocked(rosterQueries.useRemoveAthlete).mockReturnValue({ mutate: removeMutate, isPending: false } as any)
})

test('seeds the form from the plan and saves an edited goal', () => {
  render(<AthleteSettingsModal open onClose={() => {}} athlete={athlete} plan={plan} onRemoved={() => {}} onSaved={() => {}} />)
  const race = screen.getByLabelText('Goal race') as HTMLInputElement
  expect(race.value).toBe('Riverside Half')
  expect((screen.getByLabelText('Training start date') as HTMLInputElement).value).toBe('2026-06-29')
  fireEvent.change(race, { target: { value: 'City Marathon' } })
  fireEvent.change(screen.getByLabelText('Training start date'), { target: { value: '2026-07-06' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(updateMutate).toHaveBeenCalledWith(
    { goalRace: 'City Marathon', goalDistance: '13.1 mi', goalDate: '2026-09-20', goalTime: '1:45:00', startDate: '2026-07-06' },
    expect.anything(),
  )
})

test('disables goal fields when the athlete has no plan yet', () => {
  render(<AthleteSettingsModal open onClose={() => {}} athlete={athlete} plan={null} onRemoved={() => {}} onSaved={() => {}} />)
  expect(screen.getByLabelText('Goal race')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(screen.getByText(/No plan yet/)).toBeInTheDocument()
})

test('hides the Remove from roster danger zone for non-admin coaches', () => {
  render(<AthleteSettingsModal open onClose={() => {}} athlete={athlete} plan={plan} onRemoved={() => {}} onSaved={() => {}} canEdit isAdmin={false} />)
  expect(screen.queryByRole('button', { name: 'Remove from roster' })).not.toBeInTheDocument()
})

test('read-only coaches see disabled goal fields and no Save button', () => {
  render(<AthleteSettingsModal open onClose={() => {}} athlete={athlete} plan={plan} onRemoved={() => {}} onSaved={() => {}} canEdit={false} isAdmin={false} />)
  expect(screen.getByLabelText('Goal race')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  expect(screen.getByText(/view-only access/i)).toBeInTheDocument()
})

test('removal asks for confirmation, then deletes the roster link', () => {
  render(<AthleteSettingsModal open onClose={() => {}} athlete={athlete} plan={plan} onRemoved={() => {}} onSaved={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove from roster' }))
  expect(screen.getByText('Remove Jordan Lee from your roster?')).toBeInTheDocument()
  expect(removeMutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(removeMutate).toHaveBeenCalledWith({ coachId: 'coach-1', athleteId: 'ath-1' }, expect.anything())
})
