import { describe, expect, it } from 'vitest'
import { remainingPressMs } from './usePressFeedback'

describe('remainingPressMs', () => {
  it('keeps very quick clicks visible for at least 110ms', () => {
    expect(remainingPressMs(0)).toBe(110)
    expect(remainingPressMs(35)).toBe(75)
    expect(remainingPressMs(109)).toBe(1)
  })

  it('releases immediately after a long press', () => {
    expect(remainingPressMs(110)).toBe(0)
    expect(remainingPressMs(500)).toBe(0)
  })
})
