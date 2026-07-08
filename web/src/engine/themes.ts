/**
 * 테마 덱 (Phase 7 2순위) — POI를 여행 테마로 묶는다.
 * 테마는 POI의 category(=TourAPI cat 성격)에서 파생하고, category로 담기 어려운
 * 큐레이션 태그(야시장·먹자골목·노을 등)는 POI별로 보강한다. 순수 모듈.
 */
import { POI_POOL, type Poi } from '../mock/pois'

export type ThemeId = 'sea' | 'alley' | 'history' | 'night' | 'food'

export interface ThemeInfo {
  id: ThemeId
  label: string
  tagline: string
  /** 덱 카드 배경색 (방위 팔레트와 통일) */
  color: string
  emoji: string
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'sea', label: '바다', tagline: '파도 옆을 걷는 길', color: '#45b8ff', emoji: '🌊' },
  { id: 'alley', label: '골목·시장', tagline: '사람 냄새 나는 골목', color: '#ff9e7a', emoji: '🏮' },
  { id: 'history', label: '근현대·역사', tagline: '시간이 멈춘 자리', color: '#b9a7ff', emoji: '🏛️' },
  { id: 'night', label: '야간', tagline: '불이 켜지면 시작', color: '#6ea8ff', emoji: '🌙' },
  { id: 'food', label: '먹거리', tagline: '골목의 맛', color: '#ffd166', emoji: '🍜' },
] as const

// category → 기본 테마. mock/pois.ts에 등장하는 모든 category를 덮는다.
const CATEGORY_THEMES: Record<string, ThemeId[]> = {
  '골목·시장': ['alley'],
  근현대: ['history'],
  시장: ['alley', 'food'],
  산복도로: ['alley', 'history'],
  거리: ['alley'],
  '산업·예술': ['history'],
  자연: ['sea'],
  전시: ['history'],
  마을: ['sea', 'alley'],
  해안: ['sea'],
  해변: ['sea'],
  공원: ['history'],
}

// category만으로 담기 어려운 큐레이션 태그 (야시장·먹자골목·노을·카페 등)
const POI_EXTRA_THEMES: Record<string, ThemeId[]> = {
  'gukje-market': ['food', 'night'],
  'bupyeong-market': ['food', 'night'],
  chinatown: ['food', 'night'],
  'huinnyeoul-tunnel': ['night'],
  'baekje-hospital': ['food'],
}

export function themesOf(poi: Poi): ThemeId[] {
  const base = CATEGORY_THEMES[poi.category] ?? []
  const extra = POI_EXTRA_THEMES[poi.id] ?? []
  return [...new Set([...base, ...extra])]
}

export function poisByTheme(themeId: ThemeId): Poi[] {
  return POI_POOL.filter((poi) => themesOf(poi).includes(themeId))
}

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}
