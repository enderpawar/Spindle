/**
 * 테마 덱 (Phase 7 2순위) — POI를 여행 테마로 묶는다.
 * 테마는 POI의 category(=TourAPI cat 성격)에서 파생하고, category로 담기 어려운
 * 큐레이션 태그(야시장·먹자골목·노을 등)는 POI별로 보강한다. 순수 모듈.
 */
import { POI_POOL, type Poi } from '../mock/pois'

export type ThemeId = 'sea' | 'alley' | 'history' | 'night' | 'food'

export interface ThemeJourney {
  themeId: ThemeId
  /** 이번에 공개할 장면 번호, 1부터 시작 */
  step: number
  target: number
}

export interface ThemeSpinResult {
  id: ThemeId
  label: string
  color: string
  mission: string
  step: number
  target: number
}

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

const THEME_MISSIONS: Readonly<Record<ThemeId, readonly string[]>> = {
  sea: [
    '파란색 말고 오늘 바다의 색을 하나 찾아보세요.',
    '파도 소리를 20초 동안 가만히 들어보세요.',
    '수평선과 동네가 함께 보이는 장면을 남겨보세요.',
  ],
  alley: [
    '처음 보는 간판 하나를 찾아 이름을 읽어보세요.',
    '골목에서 가장 오래돼 보이는 흔적을 찾아보세요.',
    '시장 상인에게 오늘 잘 나가는 것을 물어보세요.',
  ],
  history: [
    '이 장소가 처음 생겼을 때의 부산을 상상해보세요.',
    '건물이나 길에 남은 옛 흔적 하나를 찾아보세요.',
    '오늘 처음 알게 된 부산 이야기를 한 문장으로 남겨보세요.',
  ],
  night: [
    '오늘 가장 마음에 드는 불빛 하나를 찾아보세요.',
    '낮과 달라 보이는 풍경을 한 장 남겨보세요.',
    '조용히 머물고 싶은 야경 자리를 찾아보세요.',
  ],
  food: [
    '평소라면 고르지 않을 메뉴를 하나 골라보세요.',
    '이 동네에서 처음 보는 먹거리를 찾아보세요.',
    '가게에 가장 오래된 메뉴가 무엇인지 물어보세요.',
  ],
}

/** 이동시간 다이얼을 테마 여정의 장면 수로 바꾼다. */
export function themeJourneyTarget(budgetMinutes: number): number {
  if (!Number.isFinite(budgetMinutes)) return 4
  if (budgetMinutes <= 20) return 1
  if (budgetMinutes <= 60) return 2
  return 3
}

export function pickThemeMission(themeId: ThemeId, rng: () => number): string {
  const missions = THEME_MISSIONS[themeId]
  const index = Math.min(missions.length - 1, Math.floor(rng() * missions.length))
  return missions[index]
}

export function themeSpinResult(journey: ThemeJourney, rng: () => number): ThemeSpinResult {
  const theme = themeInfo(journey.themeId)
  return {
    id: theme.id,
    label: theme.label,
    color: theme.color,
    mission: pickThemeMission(theme.id, rng),
    step: Math.min(Math.max(1, journey.step), journey.target),
    target: Math.max(1, journey.target),
  }
}

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
  전망: ['night'],
  마을: ['sea', 'alley'],
  해안: ['sea'],
  해변: ['sea'],
  공원: ['history'],
  사찰: ['history'],
}

// category만으로 담기 어려운 큐레이션 태그 (야시장·먹자골목·노을·체험 등)
const POI_EXTRA_THEMES: Record<string, ThemeId[]> = {
  'bupyeong-market': ['food', 'night'],
  'jagalchi-market': ['food'],
  'choryang-market': ['food'],
  'samjin-eomuk': ['food'],
  'huinnyeoul-tunnel': ['night'],
  // 2026-08-03 보강분
  'gukje-market': ['food'],
  'gukje-food-alley': ['food'],
  'busanjin-market': ['food'],
  'namhang-market': ['food'],
  'gongdong-fish-market': ['food'],
  'yongdusan-jagalchi': ['food', 'night'],
  'yongdusan-park': ['night'],
  'kimminbu-view': ['night'],
  'cheonmasan-view': ['night'],
  'nuribaragi-view': ['night'],
  'taejongdae': ['sea'],
  'plaza-75': ['sea'],
  'amir-park': ['sea'],
  'songdo-skywalk-bridge': ['sea'],
}

/** 테마 덱의 사진 히어로에 노출할 대표 장소. TourAPI 이미지는 화면 진입 때만 실시간 조회한다. */
const THEME_REPRESENTATIVE_POI: Readonly<Record<ThemeId, string>> = {
  sea: 'taejongdae',
  alley: 'bupyeong-market',
  history: 'baeksan-memorial',
  night: 'busan-tower',
  food: 'gukje-food-alley',
}

export function themesOf(poi: Poi): ThemeId[] {
  const base = CATEGORY_THEMES[poi.category] ?? []
  const extra = POI_EXTRA_THEMES[poi.id] ?? []
  return [...new Set([...base, ...extra])]
}

export function poisByTheme(themeId: ThemeId): Poi[] {
  return POI_POOL.filter((poi) => themesOf(poi).includes(themeId))
}

export function representativePoiForTheme(themeId: ThemeId): Poi | undefined {
  const themedPois = poisByTheme(themeId)
  return themedPois.find((poi) => poi.id === THEME_REPRESENTATIVE_POI[themeId]) ?? themedPois[0]
}

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}
