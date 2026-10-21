import { render, screen, fireEvent } from '@testing-library/react'
import { ReactionChips } from './ReactionChips'

const items = [
  { kind: 'like', emoji: '👍', label: 'Like', count: 2, mine: false, names: ['Maya Chen', 'Marcus Hale'] },
  { kind: 'congrats', emoji: '🎉', label: 'Congratulate', count: 1, mine: true, names: ['You'] },
] as any

test('used reactions always render with counts; mine is marked', () => {
  render(<ReactionChips items={items} onToggle={() => {}} showAll={false} />)
  expect(screen.getByRole('button', { name: 'Like, 2: Maya Chen, Marcus Hale' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Congratulate, 1: You' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /Laugh/ })).toBeNull()
})

test('unused kinds appear only while the message is hovered', () => {
  render(<ReactionChips items={items} onToggle={() => {}} showAll />)
  expect(screen.getByRole('button', { name: 'Laugh' })).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(5)
})

test('clicking a chip toggles that reaction; the tooltip lists who reacted', () => {
  const onToggle = vi.fn()
  render(<ReactionChips items={items} onToggle={onToggle} showAll />)
  fireEvent.click(screen.getByRole('button', { name: 'Laugh' }))
  expect(onToggle).toHaveBeenCalledWith('laugh')
  expect(screen.getByRole('button', { name: /^Like/ })).toHaveAttribute('title', 'Maya Chen, Marcus Hale')
})

test('nothing renders when there are no reactions and the message is not hovered', () => {
  const { container } = render(<ReactionChips items={[]} onToggle={() => {}} showAll={false} />)
  expect(container).toBeEmptyDOMElement()
})
