import { describe, expect, it } from 'vitest'
import type { CongestionForecast } from '../api/congestion'
import {
  buildCongestionStatusMap,
  filterCongestionStatusMap,
  mapPinLabel,
} from './congestionStatus'

const DATE = '20260805'

function forecast(attractionName: string, rate: number): CongestionForecast {
  return {
    forecastDate: DATE,
    districtCode: '26110',
    attractionName,
    rate,
  }
}

describe('buildCongestionStatusMap', () => {
  it('화면 후보 안에서만 혼잡·쾌적 상태를 만든다', () => {
    const statuses = buildCongestionStatusMap(
      [
        { id: 'busy', name: '혼잡 명소' },
        { id: 'good', name: '쾌적 명소' },
        { id: 'mid', name: '보통 명소' },
      ],
      [forecast('혼잡 명소', 70), forecast('쾌적 명소', 40), forecast('보통 명소', 55)],
      DATE,
    )

    expect([...statuses]).toEqual([
      ['good', 'good'],
      ['busy', 'busy'],
    ])
  })

  it('현재 필터 후보에 없는 명소는 상태 맵에 넣지 않는다', () => {
    const statuses = buildCongestionStatusMap(
      [{ id: 'visible', name: '보이는 명소' }],
      [forecast('보이는 명소', 80), forecast('숨은 명소', 20)],
      DATE,
    )
    expect([...statuses.keys()]).toEqual(['visible'])
  })

  it('전체 후보에서 정확 일치를 먼저 확정한 뒤 화면 필터를 적용한다', () => {
    const exact = { id: 'exact', name: '국제시장' }
    const partial = { id: 'partial', name: '국제시장 먹자골목' }
    const allStatuses = buildCongestionStatusMap(
      [exact, partial],
      [forecast('국제시장', 80)],
      DATE,
    )

    expect([...allStatuses]).toEqual([['exact', 'busy']])
    expect([...filterCongestionStatusMap(allStatuses, [partial])]).toEqual([])
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
