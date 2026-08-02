import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONGESTION_THRESHOLD,
  OLD_TOWN_LEGAL_DISTRICTS,
  clearCongestionCache,
  fetchOldTownCongestionCached,
  localYyyymmdd,
  matchBusyPois,
  normalizeAttractionName,
  type CongestionForecast,
} from './congestion'

function okList(items: unknown[]) {
  return {
    response: {
      header: { resultCode: '0000', resultMsg: 'OK' },
      body: {
        items: items.length ? { item: items } : '',
        numOfRows: '100',
        pageNo: '1',
        totalCount: String(items.length),
      },
    },
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => clearCongestionCache())

describe('fetchOldTownCongestionCached', () => {
  it('4개 구 고정 코드만 보내고 사용자 좌표·방위각은 보내지 않는다', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(okList([]))))
    await fetchOldTownCongestionCached('20260802', fetchMock as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const requestedDistricts = new Set<string>()
    for (const call of fetchMock.mock.calls) {
      const url = new URL(String(call[0]), 'https://spindle.test')
      expect(url.pathname).toBe('/api/tatsCnctrRatedList')
      expect(url.searchParams.get('areaCd')).toBe('26')
      requestedDistricts.add(url.searchParams.get('signguCd') ?? '')
      expect(url.toString()).not.toMatch(/lat|lon|lng|heading|bearing|azimuth|map[xy]/i)
    }
    expect(requestedDistricts).toEqual(new Set(OLD_TOWN_LEGAL_DISTRICTS.map((d) => d.code)))
  })

  it('같은 날짜는 세션 메모리에서 재사용하고 실패 호출은 재시도한다', async () => {
    const success = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(okList([]))))
    await fetchOldTownCongestionCached('20260802', success as typeof fetch)
    await fetchOldTownCongestionCached('20260802', success as typeof fetch)
    expect(success).toHaveBeenCalledTimes(4)

    clearCongestionCache()
    const failure = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(fetchOldTownCongestionCached('20260802', failure as typeof fetch)).rejects.toThrow()
    await expect(fetchOldTownCongestionCached('20260802', failure as typeof fetch)).rejects.toThrow()
    expect(failure).toHaveBeenCalledTimes(8)
  })
})

describe('혼잡 예측 POI 매칭', () => {
  const pois = [
    { id: 'tower', name: '부산타워' },
    { id: 'songdo', name: '부산 송도해수욕장' },
  ]
  const forecast = (overrides: Partial<CongestionForecast> = {}): CongestionForecast => ({
    forecastDate: '20260802',
    districtCode: '26110',
    attractionName: '부산타워',
    rate: CONGESTION_THRESHOLD,
    ...overrides,
  })

  it('당일 기준값 이상만 표시하고 중복은 가장 높은 값을 사용한다', () => {
    const matched = matchBusyPois(
      pois,
      [
        forecast({ rate: 69.9 }),
        forecast({ rate: 71 }),
        forecast({ rate: 84 }),
        forecast({ forecastDate: '20260803', rate: 99 }),
      ],
      '20260802',
    )
    expect(matched.size).toBe(1)
    expect(matched.get('tower')?.rate).toBe(84)
  })

  it('공백·괄호·지역명 차이는 유일할 때만 보수적으로 매칭한다', () => {
    const matched = matchBusyPois(
      pois,
      [forecast({ attractionName: '부산 송도해수욕장(관광지)', districtCode: '26140' })],
      '20260802',
    )
    expect(matched.has('songdo')).toBe(true)
    expect(normalizeAttractionName('부산 타워(전망대)')).toBe('부산타워전망대')
  })

  it('관광지명이 비슷한 POI가 여럿이면 임의로 연결하지 않는다', () => {
    const ambiguous = [
      { id: 'a', name: '부산 송도해수욕장' },
      { id: 'b', name: '송도해수욕장 관광지' },
    ]
    const matched = matchBusyPois(
      ambiguous,
      [forecast({ attractionName: '송도해수욕장' })],
      '20260802',
    )
    expect(matched.size).toBe(0)
  })

  it('로컬 날짜를 YYYYMMDD로 만든다', () => {
    expect(localYyyymmdd(new Date(2026, 7, 2))).toBe('20260802')
  })
})
