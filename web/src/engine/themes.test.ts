import { describe, expect, it } from 'vitest'
import { POI_POOL } from '../mock/pois'
import { THEMES, poisByTheme, themesOf, type ThemeId } from './themes'

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
})
