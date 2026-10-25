export type Size = { width: number; height: number }
export type Rect = { left: number; top: number; width: number; height: number }
export type Point = { left: number; top: number }
const MARGIN = 12
const GAP = 8

/** Where the focused bubble's emoji row and menu go, in viewport px: emoji row
 *  above the bubble, menu below, lined up with the bubble's open side (left of
 *  theirs, right of mine). When the stack doesn't fit, the bubble itself moves
 *  by `dy` so everything stays on screen, like iOS. */
export function focusLayout({ content, palette, menu, viewport, mine }: {
  content: Rect; palette: Size | null; menu: Size; viewport: Size; mine: boolean
}): { dy: number; palette: Point | null; menu: Point } {
  const above = palette ? palette.height + GAP : 0
  const stack = above + content.height + GAP + menu.height
  const top = Math.max(MARGIN, Math.min(content.top - above, viewport.height - MARGIN - stack))
  const dy = top + above - content.top
  const x = (w: number) => {
    const want = mine ? content.left + content.width - w : content.left
    return Math.max(MARGIN, Math.min(want, viewport.width - MARGIN - w))
  }
  return {
    dy,
    palette: palette ? { left: x(palette.width), top } : null,
    menu: { left: x(menu.width), top: top + above + content.height + GAP },
  }
}
