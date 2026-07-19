import { describe, expect, it } from 'vitest'
import { minutesToRaw, rawToMinutes } from './DialSlider'
import { DIAL_STEPS } from '../mock/pois'

describe('다이얼 슬라이더 좌표 변환 (1분 단위 연속)', () => {
  it('앵커 눈금 값은 라운드트립이 정확하다', () => {
    for (const m of DIAL_STEPS) {
      expect(rawToMinutes(minutesToRaw(m))).toBe(m)
    }
  })

  it('20~480분 모든 정수 분이 라운드트립된다 (1분 해상도)', () => {
    for (let m = 20; m <= 480; m += 1) {
      expect(rawToMinutes(minutesToRaw(m))).toBe(m)
    }
  })

  it('트랙을 따라 값이 단조증가하고 시작 20분·끝 하루(∞)다', () => {
    let prev = 0
    for (let raw = 0; raw <= 1000; raw += 1) {
      const m = rawToMinutes(raw)
      const v = Number.isFinite(m) ? m : Number.MAX_SAFE_INTEGER
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(rawToMinutes(0)).toBe(20)
    expect(rawToMinutes(1000)).toBe(Infinity)
  })

  it('범위 밖 입력은 양끝으로 클램프된다', () => {
    expect(rawToMinutes(-10)).toBe(20)
    expect(rawToMinutes(2000)).toBe(Infinity)
    expect(minutesToRaw(5)).toBe(0)
    expect(minutesToRaw(Infinity)).toBe(1000)
  })
})
