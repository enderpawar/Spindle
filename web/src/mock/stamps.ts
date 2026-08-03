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
  // 2026-08-03 보강분
  'yongdusan-park': '용두산공원',
  'modern-history-annex': '근현대역사관 별관',
  'democracy-park': '민주공원',
  'waegwan-site': '초량왜관 터',
  'baeksan-memorial': '백산기념관',
  'namseon-warehouse': '남선창고터',
  'stairs-168': '168계단',
  'kimminbu-view': '김민부전망대',
  'janggiryeo-center': '장기려 나눔센터',
  'ilsin-school': '일신여학교',
  'busanjin-market': '부산진시장',
  'busanjin-fortress': '부산진성공원',
  'tongsinsa-museum': '조선통신사역사관',
  'jagalchi-cruise': '자갈치 크루즈',
  'repair-shipyard-road': '수리조선소길',
  'namhang-market': '남항시장',
  'jeoryeong-coast': '절영해안산책로',
  taejongdae: '태종대',
  'gamji-beach': '감지해변',
  taejongsa: '태종사',
  'maritime-museum': '국립해양박물관',
  'amir-park': '아미르공원',
  'plaza-75': '75광장',
  'songdo-bolle-road': '송도해안볼레길',
  'songdo-peninsula': '송도반도',
  'songdo-skywalk-bridge': '송도용궁구름다리',
  'gongdong-fish-market': '공동어시장',
  'nuribaragi-view': '누리바라기전망대',
  'cheonmasan-view': '천마산하늘전망대',
  'provisional-capital': '임시수도기념관',
  'gukje-market': '국제시장',
  'gukje-food-alley': '국제시장 먹자골목',
  'yongdusan-jagalchi': '용두산·자갈치 특구',
  'art-street': '미술의거리',
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
