import { describe, expect, it } from 'vitest'
import { DESIGN_WIDTH, DEVICE_WIDTH_VIEWPORT, viewportContentFor } from './viewport'

describe('viewportContentFor', () => {
  it.each([320, 359, 360, 375, 389])('짧은 변 %ipx는 레이아웃 폭을 390으로 고정한다', (shortSide) => {
    expect(viewportContentFor(shortSide)).toBe(`width=${DESIGN_WIDTH}, viewport-fit=cover`)
  })

  it.each([390, 393, 430, 768, 1080])('짧은 변 %ipx는 기기 폭을 그대로 쓴다', (shortSide) => {
    expect(viewportContentFor(shortSide)).toBe(DEVICE_WIDTH_VIEWPORT)
  })

  it.each([0, Number.NaN])('화면 크기를 알 수 없으면(%s) 기기 폭을 쓴다', (shortSide) => {
    expect(viewportContentFor(shortSide)).toBe(DEVICE_WIDTH_VIEWPORT)
  })
})
