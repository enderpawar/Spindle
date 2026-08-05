import { describe, expect, it } from 'vitest'
import type { CongestionForecast } from '../api/congestion'
import { buildCongestionStatusMap, mapPinLabel } from './congestionStatus'

const DATE = '20260805'
const forecast = (attractionName: string, rate: number): CongestionForecast => ({ forecastDate: DATE, districtCode: '26110', attractionName, rate })

describe('buildCongestionStatusMap', () => {
  it('화면 후보 안에서만 혼잡·쾌적 상태를 만든다', () => {
    const statuses = buildCongestionStatusMap(
      [{ id: 'busy', name: '혼잡 명소' }, { id: 'good', name: '쾌적 명소' }, { id: 'mid', name: '보통 명소' }],
      [forecast('혼잡 명소', 70), forecast('쾌적 명소', 40), forecast('보통 명소', 55)], DATE,
    )
    expect([...statuses]).toEqual([['good', 'good'], ['busy', 'busy']])
  })
  it('현재 필터 후보에 없는 명소는 상태 맵에 넣지 않는다', () => {
    const statuses = buildCongestionStatusMap([{ id: 'visible', name: '보이는 명소' }], [forecast('보이는 명소', 80), forecast('숨은 명소', 20)], DATE)
    expect([...statuses.keys()]).toEqual(['visible'])
  })
})

describe('mapPinLabel', () => {
  it('운영 중단 안내를 혼잡 상태보다 우선한다', () => {
    expect(mapPinLabel('국제시장', true, 'busy')).toBe('국제시장, 지금 갈 수 없어요')
  })
  it('혼잡·쾌적 상태를 접근성 이름에 포함한다', () => {
    expect(mapPinLabel('국제시장', false, 'busy')).toBe('국제시장, 오늘 혼잡 예상')
    expect(mapPinLabel('흰여울문화마을', false, 'good')).toBe('흰여울문화마을, 오늘 가기 좋아요')
  })
})
