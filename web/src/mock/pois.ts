// 큐레이션 POI 풀 — 방위·티어·스토리·운영표시는 큐레이션 값이지만,
// 각 POI는 실제 TourAPI contentId에 바인딩된다. 결과 카드의 대표 이미지·소개(overview)는
// contentId로 detailCommon2/detailImage2를 결과 시점에 실시간 조회한다 (영속 저장 없음).
// contentId·좌표는 areaBasedList2(중15·동5·서11·영도14) 실호출로 확인 (2026-07-09).
// TODO(curation.md): 티어·스토리 최종 확정.

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
  /** TourAPI contentId — 결과 카드가 이 값으로 detailCommon2/detailImage2를 실시간 조회 */
  contentId: string
  name: string
  category: string
  district: string
  direction: DirectionId
  tier: Tier
  walkMinutes: number
  /** known=false면 파싱 실패로 간주하고 원문 그대로 노출 (ui.md S4) */
  open: { known: boolean; text: string }
  story: string
  /** 지도 표시용 좌표 — 정적 앱 데이터. 단말 내 렌더링에만 쓰고 어디로도 전송하지 않는다 */
  lat: number
  lon: number
}

export const POI_POOL: Poi[] = [
  // 북 — 중구 원도심 (용두산·대청동)
  {
    id: 'modern-history', contentId: '3083767', name: '부산근현대역사관 본관', category: '근현대', district: '중구', direction: 'N', tier: 1, lat: 35.1028, lon: 129.0322,
    walkMinutes: 10, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '원도심 한복판, 근대 건축물에 들어선 부산의 근현대사 전시관이에요.',
  },
  {
    id: 'busan-tower', contentId: '1277679', name: '부산타워', category: '전망', district: '중구', direction: 'N', tier: 1, lat: 35.1012, lon: 129.0324,
    walkMinutes: 10, open: { known: false, text: '운영시간은 지도에서 확인' },
    story: '용두산공원 위에서 원도심과 부산항을 한눈에 내려다보는 전망 타워.',
  },
  {
    id: 'color-village', contentId: '3064931', name: '색채마을', category: '마을', district: '중구', direction: 'N', tier: 3, lat: 35.1070, lon: 129.0295,
    walkMinutes: 15, open: { known: true, text: '상시 개방' },
    story: '산복도로 대청동, 색을 입힌 골목집들이 언덕을 따라 이어지는 마을.',
  },
  // 북동 — 동구 산복도로 (초량 이바구길)
  {
    id: 'ibagu-skyway', contentId: '2656194', name: '친환경 스카이웨이 전망대(이바구길)', category: '산복도로', district: '동구', direction: 'NE', tier: 3, lat: 35.1213, lon: 129.0307,
    walkMinutes: 20, open: { known: true, text: '상시 개방' },
    story: '산복도로 이바구길 꼭대기, 부산항이 발아래 펼쳐지는 전망대.',
  },
  {
    id: 'ibagu-workshop', contentId: '1942314', name: '이바구공작소', category: '산복도로', district: '동구', direction: 'NE', tier: 3, lat: 35.1171, lon: 129.0338,
    walkMinutes: 10, open: { known: false, text: '운영시간은 지도에서 확인' },
    story: '초량 168계단 곁, 산복도로 사람들의 이야기(이바구)를 담은 작은 전시공간.',
  },
  {
    id: 'choryang-market', contentId: '2869135', name: '초량시장', category: '시장', district: '동구', direction: 'NE', tier: 2, lat: 35.1187, lon: 129.0401,
    walkMinutes: 5, open: { known: false, text: '점포별 상이' },
    story: '초량 골목의 오래된 재래시장. 현지인의 하루가 지나가는 곳.',
  },
  // 동 — 일부러 1곳만 두어 인접 확장 데모
  {
    id: 'film-museum', contentId: '2554068', name: '부산영화체험박물관', category: '전시', district: '중구', direction: 'E', tier: 2, lat: 35.1018, lon: 129.0337,
    walkMinutes: 10, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '영화 도시 부산의 이야기를 체험으로 만나는 박물관. BIFF 광장 곁이에요.',
  },
  // 남동 — 영도 안쪽 (봉래·대평)
  {
    id: 'kangkangee', contentId: '2554070', name: '깡깡이 예술마을', category: '산업·예술', district: '영도구', direction: 'SE', tier: 3, lat: 35.0932, lon: 129.0342,
    walkMinutes: 15, open: { known: true, text: '상시 개방' },
    story: '배를 수리하는 “깡깡” 망치 소리에서 이름을 딴 마을. 수리조선소 골목이 그대로 미술관이에요.',
  },
  {
    id: 'samjin-eomuk', contentId: '2470024', name: '삼진어묵 체험·역사과학관', category: '전시', district: '영도구', direction: 'SE', tier: 2, lat: 35.0928, lon: 129.0427,
    walkMinutes: 25, open: { known: false, text: '운영시간은 지도에서 확인' },
    story: '부산 어묵의 역사를 보고 만들어보는 체험관. 갓 튀긴 어묵도 맛볼 수 있어요.',
  },
  {
    id: 'busan-bridge', contentId: '252562', name: '부산대교', category: '해안', district: '영도구', direction: 'SE', tier: 2, lat: 35.0946, lon: 129.0388,
    walkMinutes: 20, open: { known: true, text: '상시 개방' },
    story: '영도와 원도심을 잇는 다리. 다리 위에서 남항과 도심이 나란히 보여요.',
  },
  // 남 — 영도 남쪽 해안 (흰여울·동삼)
  {
    id: 'huinnyeoul-tunnel', contentId: '2606221', name: '영도 흰여울해안터널', category: '해안', district: '영도구', direction: 'S', tier: 1, lat: 35.0780, lon: 129.0453,
    walkMinutes: 5, open: { known: true, text: '상시 개방' },
    story: '터널 끝에서 바다가 액자처럼 열려요. 흰여울 해안을 잇는 짧은 산책 터널.',
  },
  {
    id: 'jungni-sunset', contentId: '3017435', name: '중리노을전망대', category: '해안', district: '영도구', direction: 'S', tier: 2, lat: 35.0692, lon: 129.0643,
    walkMinutes: 35, open: { known: true, text: '상시 개방' },
    story: '영도 서남단, 바다로 지는 노을을 마주하는 전망대.',
  },
  {
    id: 'dongsam-shell', contentId: '130774', name: '동삼동패총전시관', category: '전시', district: '영도구', direction: 'S', tier: 3, lat: 35.0712, lon: 129.0796,
    walkMinutes: 55, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '신석기 조개무지 위에 선 전시관. 태종대 가는 길에 부산의 선사시대를 만나요.',
  },
  // 남서 — 서구 송도 해안
  {
    id: 'songdo-beach', contentId: '126122', name: '부산 송도해수욕장', category: '해변', district: '서구', direction: 'SW', tier: 1, lat: 35.0739, lon: 129.0165,
    walkMinutes: 45, open: { known: true, text: '상시 개방' },
    story: '우리나라 1호 해수욕장. 백 년 전 사람들도 여기서 여름을 났어요.',
  },
  {
    id: 'songdo-cablecar', contentId: '2504464', name: '부산 송도해상케이블카', category: '해안', district: '서구', direction: 'SW', tier: 1, lat: 35.0767, lon: 129.0234,
    walkMinutes: 35, open: { known: false, text: '운영시간은 지도에서 확인' },
    story: '송도 앞바다 위를 가로지르는 케이블카. 발아래로 파도가 지나가요.',
  },
  {
    id: 'songdo-skywalk', contentId: '2557807', name: '송도 구름산책로', category: '해안', district: '서구', direction: 'SW', tier: 2, lat: 35.0754, lon: 129.0225,
    walkMinutes: 40, open: { known: true, text: '상시 개방' },
    story: '바다 위를 걷는 해상 산책로. 발밑으로 파도가 그대로 보여요.',
  },
  // 서 — 서구 내륙 (대신·구덕)
  {
    id: 'central-park', contentId: '126856', name: '부산 중앙공원', category: '공원', district: '서구', direction: 'W', tier: 2, lat: 35.1121, lon: 129.0280,
    walkMinutes: 20, open: { known: true, text: '상시 개방' },
    story: '원도심을 내려다보는 언덕 위 공원. 도심과 항구가 파노라마로 펼쳐져요.',
  },
  {
    id: 'gudeok-park', contentId: '2744597', name: '구덕문화공원', category: '공원', district: '서구', direction: 'W', tier: 3, lat: 35.1264, lon: 129.0058,
    walkMinutes: 55, open: { known: true, text: '상시 개방' },
    story: '구덕산 자락 꽃마을의 공원. 도심에서 가까운 숲 산책길이에요.',
  },
  {
    id: 'gudeok-folk', contentId: '130200', name: '구덕민속예술관', category: '전시', district: '서구', direction: 'W', tier: 3, lat: 35.1240, lon: 129.0185,
    walkMinutes: 35, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '부산의 민속·전통 예술을 잇는 공간. 대신동 숲 곁에 있어요.',
  },
  // 북서 — 중구 서쪽 시장 (부평·자갈치)
  {
    id: 'bupyeong-market', contentId: '1878218', name: '부평깡통시장', category: '시장', district: '중구', direction: 'NW', tier: 1, lat: 35.1016, lon: 129.0261,
    walkMinutes: 5, open: { known: false, text: '점포별 상이 · 야시장 저녁 운영' },
    story: '전국 최초의 상설 야시장. 통조림(깡통)에서 시작된 이름처럼 없는 게 없어요.',
  },
  {
    id: 'jagalchi-market', contentId: '132190', name: '부산 자갈치시장', category: '시장', district: '중구', direction: 'NW', tier: 1, lat: 35.0967, lon: 129.0306,
    walkMinutes: 5, open: { known: false, text: '점포별 상이' },
    story: '“오이소, 보이소” 부산을 대표하는 수산시장. 바다 내음이 진동해요.',
  },
]

export interface Recommendation {
  direction: DirectionInfo
  candidates: Poi[]
  /** 후보 부족으로 인접 방위까지 넓힌 경우 (ui.md S3 — 사유 1줄 노출) */
  expandReason?: string
}

// 스핀 추천 배선은 engine/spinRecommend.ts로 이동 — 실제 점수 엔진(방향×접근×운영×분산)을
// 출발점·다이얼과 함께 사용한다. Recommendation 타입만 이 파일에 남겨 화면들이 공유한다.

export interface Departure {
  id: string
  name: string
  desc: string
  /** 지도 표시용 좌표 — 단말 내 렌더링 전용 */
  lat: number
  lon: number
}

export const DEPARTURES: Departure[] = [
  { id: 'busan-station', name: '부산역', desc: 'KTX에서 내리자마자', lat: 35.1152, lon: 129.0403 },
  { id: 'nampo', name: '남포동', desc: '원도심 한복판에서', lat: 35.0984, lon: 129.0266 },
  { id: 'yeongdo', name: '영도 흰여울 입구', desc: '섬에서 시작하기', lat: 35.081, lon: 129.0463 },
]

/**
 * 이동시간 다이얼 앵커 눈금 — 슬라이더는 이 앵커 사이를 1분 단위로 부드럽게 보간한다
 * (스냅 없음, components/DialSlider). 값은 분 단위 예산으로 엔진에 그대로 전달되며,
 * Infinity = 하루(권역 내 무제한).
 */
export const DIAL_STEPS: readonly number[] = [20, 30, 40, 60, 90, 120, 180, 240, Infinity]

export const DIAL_DEFAULT_MINUTES = 40

/** 20 → "20분", 90 → "1시간 30분", Infinity → "하루" */
export function dialTimeLabel(minutes: number): string {
  if (!Number.isFinite(minutes)) return '하루'
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/** 요약용 분위기 라벨 — 가볍게(≤30) / 반나절(≤90) / 느긋하게 / 하루 */
export function dialMoodLabel(minutes: number): string {
  if (!Number.isFinite(minutes)) return '하루'
  if (minutes <= 30) return '가볍게'
  if (minutes <= 90) return '반나절'
  return '느긋하게'
}

/** 요약 설명 — "이동 40분까지" / "멀어도 좋아요" */
export function dialDesc(minutes: number): string {
  return Number.isFinite(minutes) ? `이동 ${dialTimeLabel(minutes)}까지` : '멀어도 좋아요'
}
