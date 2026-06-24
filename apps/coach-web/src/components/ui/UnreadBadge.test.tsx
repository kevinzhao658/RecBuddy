import { render, screen } from '@testing-library/react'
import { UnreadBadge } from './UnreadBadge'

test('renders the count', () => {
  render(<UnreadBadge count={3} />)
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('caps at 9+', () => {
  render(<UnreadBadge count={42} />)
  expect(screen.getByText('9+')).toBeInTheDocument()
})

test('renders nothing at 0', () => {
  const { container } = render(<UnreadBadge count={0} />)
  expect(container).toBeEmptyDOMElement()
})
