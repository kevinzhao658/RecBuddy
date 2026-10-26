import { thumbSize } from './thumbSize'

test('portrait media fits the 240 × 320 thumbnail by height', () => {
  expect(thumbSize(665, 1182)).toEqual({ width: 180, height: 320 })
  expect(thumbSize(720, 1280)).toEqual({ width: 180, height: 320 })
})

test('landscape media fits by width', () => {
  expect(thumbSize(1280, 720)).toEqual({ width: 240, height: 135 })
})

test('small media is never enlarged, and missing sizes fall back to 4:3', () => {
  expect(thumbSize(100, 80)).toEqual({ width: 100, height: 80 })
  expect(thumbSize(undefined, undefined)).toEqual({ width: 240, height: 180 })
})
