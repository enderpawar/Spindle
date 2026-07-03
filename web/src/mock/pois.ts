// 목데이터 — Phase 2에서 TourAPI(areaBasedList2) + 추천 엔진으로 대체된다.
// 여기 있는 큐레이션 메시지·티어·운영상태는 전부 임시값이다. // TODO(zones.md, curation.md)

export type DirectionId = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface DirectionInfo {
  id: DirectionId
  label: string
  /** 방위 색상 — 하루의 시간대(새벽~밤)를 8방위에 입힌 팔레트 */
  color: string
  /** 8방위 큐레이션 메시지 (Phase 5 확정 전 임시, 공백 포함 25자 내외) */
  message: string
}

export const DIRECTIONS: DirectionInfo[] = [
  { id: 'N', label: '북', color: '#6ea8ff', message: '오래된 골목의 방향. 천천히 걸어볼까요' },
  { id: 'NE', label: '북동', color: '#7ee0c3', message: '언덕 위 이야기가 기다려요. 숨 고르고 올라가요' },
  { id: 'E', label: '동', color: '#ffd166', message: '시작과 새벽의 방향. 떠오르는 해를 만나러 가요' },
  { id: 'SE', label: '남동', color: '#62d4e3', message: '섬의 안쪽으로. 바닷바람이 길을 알려줘요' },
  { id: 'S', label: '남', color: '#45b8ff', message: '바다 냄새가 나는 쪽. 파도 소리를 따라가요' },
  { id: 'SW', label: '남서', color: '#ff9e7a', message: '골목 끝에 바다가 걸린 동네로 가요' },
  { id: 'W', label: '서', color: '#ff7a45', message: '노을이 먼저 닿는 곳. 하루의 끝을 마중 가요' },
  { id: 'NW', label: '북서', color: '#b9a7ff', message: '시장 소리가 들리는 쪽. 출출할 준비 됐나요' },
]

/** 방위각(0=북, 시계방향) → 8방위. 경계(22.5°)는 반올림으로 처리 */
export function directionFromHeading(headingDeg: number): DirectionInfo {
  const normalized = ((headingDeg % 360) + 360) % 360
  return DIRECTIONS[Math.round(normalized / 45) % 8]
}

/** 큐레이션 티어 — 1: 대표 명소, 2: 알려진 곳, 3: 숨은 명소 (docs/curation.md 확정 전 임시) */
export type Tier = 1 | 2 | 3

export interface Poi {
  id: string
  name: string
  category: string
  district: string
  direction: DirectionId
  tier: Tier
  walkMinutes: number
  /** known=false면 파싱 실패로 간주하고 원문 그대로 노출 (ui.md S4) */
  open: { known: boolean; text: string }
  story: string
}

export const POI_POOL: Poi[] = [
  // 북 — 중구 안쪽
  {
    id: 'bosu-books', name: '보수동책방골목', category: '골목·시장', district: '중구', direction: 'N', tier: 2,
    walkMinutes: 12, open: { known: true, text: '오늘 열음 · 10:00–19:00' },
    story: '한국전쟁 때 노점 책방에서 시작된 헌책방 거리. 종이 냄새 사이로 반세기의 이야기가 쌓여 있어요.',
  },
  {
    id: 'modern-history', name: '부산근현대역사관', category: '근현대', district: '중구', direction: 'N', tier: 2,
    walkMinutes: 9, open: { known: true, text: '오늘 개관 · 09:00–18:00' },
    story: '옛 은행 건물이 그대로 전시장이 됐어요. 지하 금고실까지 남아 있는 근현대 타임캡슐.',
  },
  {
    id: 'gukje-market', name: '국제시장', category: '시장', district: '중구', direction: 'N', tier: 1,
    walkMinutes: 8, open: { known: false, text: '점포별 상이' },
    story: '영화로 유명해졌지만, 골목 안쪽 공구 거리와 먹자골목은 여전히 현지인의 시간표로 움직여요.',
  },
  // 북동 — 동구 산복도로
  {
    id: 'ibagu-road', name: '초량 이바구길', category: '산복도로', district: '동구', direction: 'NE', tier: 3,
    walkMinutes: 22, open: { known: true, text: '상시 개방' },
    story: '168계단과 모노레일, 담벼락의 이야기(이바구)를 따라 오르는 길. 꼭대기에서 부산항이 한눈에.',
  },
  {
    id: 'baekje-hospital', name: '브라운핸즈 백제', category: '근현대', district: '동구', direction: 'NE', tier: 3,
    walkMinutes: 15, open: { known: true, text: '오늘 영업 · 10:00–22:00' },
    story: '1927년 부산 최초의 근대식 개인병원이 카페가 됐어요. 벽돌 하나하나가 백 년 전 그대로.',
  },
  {
    id: 'chinatown', name: '초량 차이나타운', category: '거리', district: '동구', direction: 'NE', tier: 2,
    walkMinutes: 14, open: { known: true, text: '상시 개방' },
    story: '부산역 맞은편, 붉은 등 아래 화교 3대가 만두를 빚는 골목. 저녁이면 불빛이 더 예뻐요.',
  },
  // 동 — 일부러 1곳만 두어 인접 확장 데모
  {
    id: 'forty-stairs', name: '40계단 문화관광테마거리', category: '근현대', district: '중구', direction: 'E', tier: 2,
    walkMinutes: 6, open: { known: true, text: '상시 개방' },
    story: '피란 시절 헤어진 가족을 서로 찾던 계단. 지금은 그 시절 풍경이 조형물로 남아 있어요.',
  },
  // 남동 — 영도 동쪽
  {
    id: 'kangkangee', name: '깡깡이예술마을', category: '산업·예술', district: '영도구', direction: 'SE', tier: 3,
    walkMinutes: 28, open: { known: true, text: '마을박물관 10:00–17:00' },
    story: '배를 수리하는 망치 소리 “깡깡”에서 이름을 딴 마을. 수리조선소 사이 골목이 그대로 미술관이에요.',
  },
  {
    id: 'taejongdae', name: '태종대', category: '자연', district: '영도구', direction: 'SE', tier: 1,
    walkMinutes: 55, open: { known: true, text: '오늘 개방 · 05:00–24:00' },
    story: '절벽 위 등대에서 맑은 날엔 대마도까지 보여요. 다누비열차가 순환해서 걷다 지치면 타면 돼요.',
  },
  {
    id: 'maritime-museum', name: '국립해양박물관', category: '전시', district: '영도구', direction: 'SE', tier: 2,
    walkMinutes: 40, open: { known: true, text: '오늘 개관 · 09:00–18:00' },
    story: '바다 도시 부산이 모은 바다의 모든 것. 4층 통유리 너머로 진짜 바다가 전시의 마지막 방이에요.',
  },
  // 남 — 영도 서쪽 해안
  {
    id: 'huinnyeoul', name: '흰여울문화마을', category: '마을', district: '영도구', direction: 'S', tier: 1,
    walkMinutes: 25, open: { known: true, text: '상시 개방' },
    story: '절벽 골목 아래로 바다가 흘러요. 피란민의 터전이 부산에서 가장 그림 같은 산책로가 됐어요.',
  },
  {
    id: 'jeolyeong-coast', name: '절영해안산책로', category: '해안', district: '영도구', direction: 'S', tier: 3,
    walkMinutes: 30, open: { known: true, text: '상시 개방' },
    story: '파도 바로 옆을 걷는 길. 흰여울에서 내려와 바다와 나란히, 등대까지 걸어보세요.',
  },
  {
    id: 'huinnyeoul-tunnel', name: '흰여울해안터널', category: '해안', district: '영도구', direction: 'S', tier: 3,
    walkMinutes: 27, open: { known: true, text: '상시 개방' },
    story: '터널 끝에서 바다가 액자처럼 열려요. 노을 시간엔 누구든 걸음을 멈추게 되는 곳.',
  },
  // 남서 — 서구 해안
  {
    id: 'songdo-bridge', name: '송도용궁구름다리', category: '해안', district: '서구', direction: 'SW', tier: 2,
    walkMinutes: 45, open: { known: true, text: '오늘 운영 · 09:00–18:00 (월 휴무)' },
    story: '무인도 동섬까지 바다 위를 걷는 다리. 발아래 유리 바닥으로 파도가 지나가요.',
  },
  {
    id: 'amnam-park', name: '암남공원', category: '자연', district: '서구', direction: 'SW', tier: 3,
    walkMinutes: 50, open: { known: true, text: '상시 개방' },
    story: '숲길과 기암절벽 해안이 나란한 공원. 케이블카 아래 숨은 산책로는 아는 사람만 걸어요.',
  },
  {
    id: 'songdo-beach', name: '송도해수욕장', category: '해변', district: '서구', direction: 'SW', tier: 1,
    walkMinutes: 40, open: { known: true, text: '상시 개방' },
    story: '우리나라 1호 해수욕장. 백 년 전 사람들도 여기서 여름을 났어요.',
  },
  // 서 — 서구 내륙
  {
    id: 'provisional-capital', name: '임시수도기념관', category: '근현대', district: '서구', direction: 'W', tier: 3,
    walkMinutes: 20, open: { known: true, text: '오늘 개관 · 09:00–18:00' },
    story: '전쟁 중 3년, 부산이 수도였던 시절의 대통령 관저. 정원이 유난히 고요해요.',
  },
  {
    id: 'ami-village', name: '아미동 비석문화마을', category: '산복도로', district: '서구', direction: 'W', tier: 3,
    walkMinutes: 35, open: { known: true, text: '상시 개방' },
    story: '묘지 위에 피란민이 집을 지어야 했던 동네. 무겁고도 뭉클한, 부산의 속살 같은 골목.',
  },
  {
    id: 'seokdang-museum', name: '동아대 석당박물관', category: '전시', district: '서구', direction: 'W', tier: 3,
    walkMinutes: 18, open: { known: true, text: '오늘 개관 · 09:30–17:00' },
    story: '옛 임시수도 정부청사가 통째로 박물관이 됐어요. 붉은 벽돌 복도가 근사해요.',
  },
  // 북서 — 중구 서쪽
  {
    id: 'bupyeong-market', name: '부평깡통시장', category: '시장', district: '중구', direction: 'NW', tier: 1,
    walkMinutes: 10, open: { known: true, text: '야시장 19:30–24:00' },
    story: '전국 최초의 상설 야시장. 통조림(깡통)에서 시작된 이름처럼 없는 게 없어요.',
  },
  {
    id: 'democracy-park', name: '민주공원·중앙공원', category: '공원', district: '중구', direction: 'NW', tier: 3,
    walkMinutes: 30, open: { known: true, text: '상시 개방' },
    story: '원도심 지붕 위의 공원. 부산 시가지와 항구가 파노라마로 펼쳐져요.',
  },
]

export interface Recommendation {
  direction: DirectionInfo
  candidates: Poi[]
  /** 후보 부족으로 인접 방위까지 넓힌 경우 (ui.md S3 — 사유 1줄 노출) */
  expandReason?: string
}

const DIR_INDEX: Record<DirectionId, number> = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 }

/**
 * 목 추천 — 실제 점수 엔진(Phase 2)의 형태만 흉내 낸다:
 * 방위 필터 → 후보 3개 미만이면 인접 방위 확장 + 사유 문자열.
 */
export function recommend(headingDeg: number): Recommendation {
  const direction = directionFromHeading(headingDeg)
  const idx = DIR_INDEX[direction.id]
  let candidates = POI_POOL.filter((p) => p.direction === direction.id)
  let expandReason: string | undefined

  if (candidates.length < 3) {
    const left = DIRECTIONS[(idx + 7) % 8]
    const right = DIRECTIONS[(idx + 1) % 8]
    const extra = POI_POOL.filter((p) => p.direction === left.id || p.direction === right.id)
    candidates = [...candidates, ...extra].slice(0, 3)
    expandReason = `${direction.label}쪽은 후보가 적어서, ${left.label}·${right.label}까지 살짝 넓혔어요`
  }

  // 목 단계의 얕은 셔플 — 첫 후보가 늘 같지 않게만
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 3)
  return { direction, candidates: shuffled, expandReason }
}

export interface Departure {
  id: string
  name: string
  desc: string
}

export const DEPARTURES: Departure[] = [
  { id: 'busan-station', name: '부산역', desc: 'KTX에서 내리자마자' },
  { id: 'nampo', name: '남포동', desc: '원도심 한복판에서' },
  { id: 'yeongdo', name: '영도 흰여울 입구', desc: '섬에서 시작하기' },
]

export type DialId = 'light' | 'half' | 'full'

export const DIALS: { id: DialId; label: string; desc: string }[] = [
  { id: 'light', label: '가볍게', desc: '걸어서 20분' },
  { id: 'half', label: '반나절', desc: '40분까지' },
  { id: 'full', label: '하루', desc: '멀어도 좋아요' },
]
