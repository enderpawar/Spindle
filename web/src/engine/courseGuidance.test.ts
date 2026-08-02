import { describe, expect, it } from 'vitest'
import { advanceArrival, guidanceSnapshot, guidanceTurn, relativeHeadingDeg } from './courseGuidance'

describe('코스 탐험형 방향 안내', () => {
  it('0/360 경계에서 가장 짧은 상대각을 계산한다', () => {
    expect(relativeHeadingDeg(5, 355)).toBe(10)
    expect(relativeHeadingDeg(355, 5)).toBe(-10)
  })

  it('직진·좌·우·뒤쪽을 경계대로 분류한다', () => {
    expect(guidanceTurn(30)).toBe('forward')
    expect(guidanceTurn(31)).toBe('right')
    expect(guidanceTurn(-31)).toBe('left')
    expect(guidanceTurn(150)).toBe('behind')
    expect(guidanceTurn(-150)).toBe('behind')
  })

  it('직전 분류를 경계 밖 8도까지 유지한다', () => {
    expect(guidanceTurn(36, 'forward')).toBe('forward')
    expect(guidanceTurn(39, 'forward')).toBe('right')
    expect(guidanceTurn(145, 'right')).toBe('right')
    expect(guidanceTurn(159, 'right')).toBe('behind')
  })

  it('현재 위치에서 목표 거리와 방향을 단말에서 계산한다', () => {
    const snapshot = guidanceSnapshot({ lat: 35, lng: 129 }, { lat: 35.001, lng: 129 }, 0)
    expect(snapshot.distanceM).toBeGreaterThan(100)
    expect(snapshot.turn).toBe('forward')
  })

  it('정확도 80m 이하의 50m 이내 표본 2회 연속에서만 도착한다', () => {
    expect(advanceArrival(0, 40, 81)).toEqual({ consecutive: 0, arrived: false })
    expect(advanceArrival(0, 40, 30)).toEqual({ consecutive: 1, arrived: false })
    expect(advanceArrival(1, 40, 30)).toEqual({ consecutive: 2, arrived: true })
    expect(advanceArrival(1, 60, 30)).toEqual({ consecutive: 0, arrived: false })
  })
})
