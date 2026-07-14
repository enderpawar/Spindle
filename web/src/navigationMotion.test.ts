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
  })

  it('preserves the spin reveal ritual', () => {
    expect(transitionFor('spin', 'reveal')).toBe('ritual')
    expect(transitionFor('reveal', 'result')).toBe('ritual')
  })
})
