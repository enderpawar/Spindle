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
  'modern-history': '근현대역사관',
  'busan-tower': '부산타워',
  'color-village': '색채마을',
  'ibagu-skyway': '이바구전망대',
  'ibagu-workshop': '이바구공작소',
  'choryang-market': '초량시장',
  'film-museum': '영화체험박물관',
  kangkangee: '깡깡이마을',
  'samjin-eomuk': '삼진어묵',
  'busan-bridge': '부산대교',
  'huinnyeoul-tunnel': '흰여울해안터널',
  'jungni-sunset': '중리노을전망대',
  'dongsam-shell': '동삼동패총',
  'songdo-beach': '송도해수욕장',
  'songdo-cablecar': '송도케이블카',
  'songdo-skywalk': '송도구름산책로',
  'central-park': '중앙공원',
  'gudeok-park': '구덕문화공원',
  'gudeok-folk': '구덕민속예술관',
  'bupyeong-market': '깡통시장',
  'jagalchi-market': '자갈치시장',
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
