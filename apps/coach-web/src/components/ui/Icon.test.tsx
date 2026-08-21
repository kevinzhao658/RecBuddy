import { render } from '@testing-library/react'
import { TypeIcon, SportIcon } from './Icon'

test('TypeIcon inherits currentColor — no baked-in tint style', () => {
  const { container } = render(<TypeIcon type="tempo" className="text-accent" />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('style')).toBeNull()
  expect(svg.getAttribute('class')).toContain('text-accent')
})

test('cross renders circling arrows (two arcs + two arrowheads), not a bicycle', () => {
  const { container } = render(<TypeIcon type="cross" />)
  expect(container.querySelectorAll('circle')).toHaveLength(0)      // bicycle had two wheel circles
  expect(container.querySelectorAll('polyline')).toHaveLength(2)    // the two arrowheads
})

test('recovery heart carries no renewal arrow', () => {
  const { container } = render(<TypeIcon type="recovery" />)
  expect(container.querySelectorAll('path')).toHaveLength(1)        // heart only (old icon had 2 paths)
})

test('a logged ride still shows a bicycle', () => {
  const { container } = render(<SportIcon sport="ride" />)
  expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
})
