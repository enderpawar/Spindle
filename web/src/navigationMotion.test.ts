import { describe, expect, it } from 'vitest'
import { transitionFor } from './navigationMotion'

describe('transitionFor', () => {
  it('keeps peer tab navigation calm', () => {
    expect(transitionFor('home', 'spots')).toBe('tab')
    expect(transitionFor('settings', 'home')).toBe('tab')
    expect(transitionFor('onboarding', 'home')).toBe('tab')
  })

  it('marks drill-down and return directions', () => {
    expect(transitionFor('home', 'departure')).toBe('forward')
    expect(transitionFor('departure', 'home')).toBe('back')
    expect(transitionFor('result', 'share')).toBe('forward')
    expect(transitionFor('share', 'result')).toBe('back')
    expect(transitionFor('theme', 'result')).toBe('forward')
    expect(transitionFor('result', 'theme')).toBe('back')
    expect(transitionFor('course', 'spin')).toBe('back')
    expect(transitionFor('origin-pick', 'home')).toBe('back')
    expect(transitionFor('origin-pick', 'spin')).toBe('back')
    expect(transitionFor('origin-pick', 'settings')).toBe('back')
  })

  it('preserves the spin reveal ritual', () => {
    expect(transitionFor('spin', 'reveal')).toBe('ritual')
    expect(transitionFor('reveal', 'result')).toBe('ritual')
  })

  it('treats leaving the reveal as a return, not a drill-down', () => {
    // 하드웨어 뒤로가기로만 생기는 경로 (navigation/backAction.ts)
    expect(transitionFor('reveal', 'spin')).toBe('back')
  })
})
