import { describe, expect, it, vi } from 'vitest'
import type { ExtraSpot } from '../api/extraSpots'
import { DEPARTURES } from '../mock/pois'
import { recommendDiningSpin } from './diningSpin'
import { seededRng } from './rng'
import { travelMinutes } from './zones'

vi.mock('./spinRecommend', async importOriginal => ({
  ...await importOriginal<typeof import('./spinRecommend')>(),
  operationScoreOf: (id: string) => id === 'closed' ? 0 : 1,
}))

const departure = DEPARTURES[0]
const spot = (id: string, category = '카페', delta = .001): ExtraSpot => ({
  id, contentId: id, name: id, category, district: '동구',
  lat: departure.lat + delta, lon: departure.lon,
})
const spots = [spot('cafe1'), spot('cafe2', '카페', .002), spot('food', '음식점'), spot('tour', '관광지')]
const input = { departure, heading: 0, budgetMinutes: 40, category: '카페' as const, spots }

describe('음식점·카페 전용 스핀', () => {
  it('음식점과 카페를 모든 방위에서 서로 섞지 않는다', () => {
    for (const category of ['음식점', '카페'] as const) for (let heading = 0; heading < 360; heading += 45) {
      const result = recommendDiningSpin({ ...input, category, heading })
      expect(result.diningCategory).toBe(category)
      expect(result.candidates.every(poi => poi.category === category)).toBe(true)
    }
    expect(recommendDiningSpin(input).candidates).toHaveLength(2)
  })
  it('다른 방향으로 확장한 경우 선택 종류가 포함된 사유를 표시한다', () => {
    const result = recommendDiningSpin({ ...input, heading: 90 })
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.expandReason).toContain('카페')
  })
  it('카페가 없으면 음식점이나 정적 관광지로 대체하지 않는다', () => {
    expect(recommendDiningSpin({ ...input, spots: [spot('food', '음식점')] }).candidates).toEqual([])
  })
  it('이동시간 초과 후보를 무제한으로 다시 추천하지 않는다', () => {
    const far = spot('far', '카페', .05)
    expect(recommendDiningSpin({ ...input, spots: [far], budgetMinutes: 20 }).candidates).toEqual([])
    expect(recommendDiningSpin({ ...input, spots: [far], budgetMinutes: Infinity }).candidates).toHaveLength(1)
  })
  it('정확한 이동시간 경계는 포함하고 경계 직전은 제외한다', () => {
    const near = spots[0]
    const minutes = travelMinutes({ lat: departure.lat, lng: departure.lon }, { lat: near.lat, lng: near.lon }).minutes
    expect(recommendDiningSpin({ ...input, spots: [near], budgetMinutes: minutes }).candidates).toHaveLength(1)
    expect(recommendDiningSpin({ ...input, spots: [near], budgetMinutes: minutes - .01 }).candidates).toEqual([])
  })
  it('운영 중단 장소는 후보 부족 시에도 다시 포함하지 않는다', () => {
    expect(recommendDiningSpin({ ...input, spots: [spot('closed')] }).candidates).toEqual([])
  })
  it('직전 결과를 제외하고, 유일한 장소여도 조용히 반복하지 않는다', () => {
    expect(recommendDiningSpin({ ...input, prevContentId: 'cafe1' }).candidates.map(p => p.contentId)).toEqual(['cafe2'])
    expect(recommendDiningSpin({ ...input, spots: [spots[0]], prevContentId: 'cafe1' }).candidates).toEqual([])
  })
  it('같은 시드는 같은 결과이고 상세·공유용 정보를 보존한다', () => {
    const a = recommendDiningSpin({ ...input, rng: seededRng(4) })
    const b = recommendDiningSpin({ ...input, rng: seededRng(4) })
    expect(a).toEqual(b)
    expect(a.candidates.every(p => p.contentId && p.walkMinutes >= 1 && p.tier === 2)).toBe(true)
    expect(a.theme).toBeUndefined()
  })
})
