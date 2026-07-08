// 도장깨기 존 구성 — 슬롯은 POI 풀에서 파생한다.
// 방문 여부(collected)는 단말 localStorage(lib/visited.ts)에서 실시간으로 읽는다.

import { POI_POOL, type Poi } from './pois'

export interface StampSlot {
  poi: Poi
  shortName: string
}

export interface Zone {
  id: string
  label: string
  slots: StampSlot[]
}

const SHORT_NAMES: Record<string, string> = {
  'bosu-books': '보수동책방',
  'modern-history': '근현대역사관',
  'gukje-market': '국제시장',
  'ibagu-road': '이바구길',
  'baekje-hospital': '옛 백제병원',
  chinatown: '차이나타운',
  'forty-stairs': '40계단',
  kangkangee: '깡깡이마을',
  taejongdae: '태종대',
  'maritime-museum': '해양박물관',
  huinnyeoul: '흰여울마을',
  'jeolyeong-coast': '절영산책로',
  'huinnyeoul-tunnel': '해안터널',
  'songdo-bridge': '용궁구름다리',
  'amnam-park': '암남공원',
  'songdo-beach': '송도해수욕장',
  'provisional-capital': '임시수도기념관',
  'ami-village': '아미동 비석마을',
  'seokdang-museum': '석당박물관',
  'bupyeong-market': '깡통시장',
  'democracy-park': '민주공원',
}

const DISTRICT_ORDER = ['영도구', '동구', '서구', '중구']

export const zones: Zone[] = DISTRICT_ORDER.map((district) => ({
  id: district,
  label: district,
  slots: POI_POOL.filter((p) => p.district === district).map((poi) => ({
    poi,
    shortName: SHORT_NAMES[poi.id] ?? poi.name,
  })),
}))

const ALL_SLOTS = zones.flatMap((z) => z.slots)

/** 방문 집합(lib/visited.ts) 기준 수집 현황. */
export const stampProgress = (visited: Set<string>) => ({
  collected: ALL_SLOTS.filter((s) => visited.has(s.poi.id)).length,
  total: ALL_SLOTS.length,
})
