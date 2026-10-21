import { actionBarPosition } from './MessageActions'

// Wrapper 800 wide; bar 280 wide, 30 tall; bubble rows are relative to the wrapper.
const bar = { width: 280, height: 30 }

test("sits just right of a short bubble from someone else, centred on it", () => {
  expect(actionBarPosition({ wrapperWidth: 800, bubble: { left: 0, right: 300, top: 20, height: 40 }, bar, mine: false }))
    .toEqual({ left: 308, top: 25 })
})

test('sits just left of a short bubble of mine', () => {
  expect(actionBarPosition({ wrapperWidth: 800, bubble: { left: 500, right: 800, top: 0, height: 40 }, bar, mine: true }))
    .toEqual({ left: 212, top: 5 })
})

test("overlaps the top edge of a wide bubble when there's no room beside it", () => {
  expect(actionBarPosition({ wrapperWidth: 800, bubble: { left: 0, right: 680, top: 20, height: 60 }, bar, mine: false }))
    .toEqual({ left: 400, top: 8 })
  expect(actionBarPosition({ wrapperWidth: 800, bubble: { left: 120, right: 800, top: 0, height: 60 }, bar, mine: true }))
    .toEqual({ left: 120, top: -12 })
})
