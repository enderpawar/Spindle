import { describe, expect, it } from 'vitest'
import { POI_POOL } from '../mock/pois'
import {
  THEMES,
  pickThemeMission,
  poisByTheme,
  representativePoiForTheme,
  themeJourneyTarget,
  themeSpinResult,
  themesOf,
  type ThemeId,
} from './themes'

describe('themes', () => {
  it('모든 POI는 최소 1개 테마에 속한다 (빈 덱 방지)', () => {
    for (const poi of POI_POOL) {
      expect(themesOf(poi).length, `${poi.id} 테마 없음`).toBeGreaterThan(0)
    }
  })

  it('모든 테마 덱은 최소 2개 POI를 가진다 (덱이 비지 않게)', () => {
    for (const theme of THEMES) {
      expect(poisByTheme(theme.id).length, `${theme.id} 덱 부족`).toBeGreaterThanOrEqual(2)
    }
  })

  it('모든 테마의 대표 사진 장소는 실제 해당 테마 후보에 속한다', () => {
    for (const theme of THEMES) {
      const representative = representativePoiForTheme(theme.id)
      expect(representative, `${theme.id} 대표 장소 없음`).toBeDefined()
      expect(themesOf(representative!).includes(theme.id), `${theme.id} 대표 장소 테마 불일치`).toBe(true)
    }
  })

  it('큐레이션 태그가 category 밖 테마를 보강한다 (야시장→먹거리·야간)', () => {
    const foodIds = poisByTheme('food').map((p) => p.id)
    expect(foodIds).toContain('jagalchi-market')
    expect(foodIds).toContain('bupyeong-market')
    const nightIds = poisByTheme('night').map((p) => p.id)
    expect(nightIds).toContain('bupyeong-market')
  })

  it('바다 테마는 해안·해변·마을 POI를 포함한다', () => {
    const seaIds = poisByTheme('sea').map((p) => p.id)
    expect(seaIds).toContain('huinnyeoul-tunnel')
    expect(seaIds).toContain('songdo-beach')
    expect(seaIds).toContain('busan-bridge')
  })

  it('themesOf는 중복 없는 테마 목록을 반환한다', () => {
    for (const poi of POI_POOL) {
      const list = themesOf(poi)
      expect(new Set(list).size).toBe(list.length)
      for (const id of list) {
        expect(THEMES.map((t) => t.id as ThemeId)).toContain(id)
      }
    }
  })

  it('이동시간별 테마 여정 장면 수 경계를 지킨다', () => {
    expect(themeJourneyTarget(20)).toBe(1)
    expect(themeJourneyTarget(21)).toBe(2)
    expect(themeJourneyTarget(60)).toBe(2)
    expect(themeJourneyTarget(61)).toBe(3)
    expect(themeJourneyTarget(Infinity)).toBe(4)
  })

  it('미션과 장면 메타는 RNG 고정 시 재현되고 범위를 벗어나지 않는다', () => {
    expect(pickThemeMission('sea', () => 0)).toBe(pickThemeMission('sea', () => 0))
    const result = themeSpinResult({ themeId: 'history', step: 9, target: 3 }, () => 0.99)
    expect(result.label).toBe('근현대·역사')
    expect(result.step).toBe(3)
    expect(result.target).toBe(3)
    expect(result.mission.length).toBeGreaterThan(0)
  })
})
