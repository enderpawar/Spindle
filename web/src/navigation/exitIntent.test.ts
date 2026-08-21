import { describe, expect, it } from 'vitest'
import { decideExit, EXIT_CONFIRM_WINDOW_MS } from './exitIntent'

describe('decideExit', () => {
  it('첫 뒤로가기는 안내만 띄운다', () => {
    expect(decideExit(1_000, null)).toEqual({ kind: 'notice', armedUntil: 1_000 + EXIT_CONFIRM_WINDOW_MS })
  })

  it('안내가 살아 있는 동안 다시 누르면 종료한다', () => {
    expect(decideExit(1_500, 3_000)).toEqual({ kind: 'exit' })
  })

  it('창의 마지막 순간까지는 종료로 받는다', () => {
    expect(decideExit(3_000, 3_000)).toEqual({ kind: 'exit' })
  })

  it('창이 지나면 곧바로 끄지 않고 안내부터 다시 시작한다', () => {
    expect(decideExit(3_001, 3_000)).toEqual({ kind: 'notice', armedUntil: 3_001 + EXIT_CONFIRM_WINDOW_MS })
  })
})
