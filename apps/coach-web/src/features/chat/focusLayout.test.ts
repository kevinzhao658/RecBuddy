import { focusLayout } from './focusLayout'

// Viewport 1000 × 800. Emoji row 230 × 40, menu card 220 × 160, 12 px margin, 8 px gap.
const viewport = { width: 1000, height: 800 }
const palette = { width: 230, height: 40 }
const menu = { width: 220, height: 160 }

test('with room: emoji row above, menu below, aligned to the left of their bubble, nothing moves', () => {
  expect(focusLayout({ content: { left: 100, top: 300, width: 200, height: 40 }, palette, menu, viewport, mine: false }))
    .toEqual({ dy: 0, palette: { left: 100, top: 252 }, menu: { left: 100, top: 348 } })
})

test('my bubble: both line up with its right edge', () => {
  expect(focusLayout({ content: { left: 700, top: 300, width: 250, height: 40 }, palette, menu, viewport, mine: true }))
    .toEqual({ dy: 0, palette: { left: 720, top: 252 }, menu: { left: 730, top: 348 } })
})

test('near the bottom, the bubble lifts so the whole menu fits', () => {
  // stack = 40 + 8 + 40 + 8 + 160 = 256; must end by 788 → starts at 532
  expect(focusLayout({ content: { left: 100, top: 700, width: 200, height: 40 }, palette, menu, viewport, mine: false }))
    .toEqual({ dy: -120, palette: { left: 100, top: 532 }, menu: { left: 100, top: 628 } })
})

test('near the top, the bubble drops so the emoji row stays on screen', () => {
  expect(focusLayout({ content: { left: 100, top: 20, width: 200, height: 40 }, palette, menu, viewport, mine: false }))
    .toEqual({ dy: 40, palette: { left: 100, top: 12 }, menu: { left: 100, top: 108 } })
})

test('stays inside the side margins', () => {
  const out = focusLayout({ content: { left: 0, top: 300, width: 100, height: 40 }, palette, menu, viewport: { width: 200, height: 800 }, mine: false })
  expect(out.palette).toEqual({ left: 12, top: 252 })
  expect(out.menu).toEqual({ left: 12, top: 348 })
})

test('without reactions there is no emoji row', () => {
  expect(focusLayout({ content: { left: 100, top: 300, width: 200, height: 40 }, palette: null, menu, viewport, mine: false }))
    .toEqual({ dy: 0, palette: null, menu: { left: 100, top: 348 } })
})
