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

const DIRECTION_BY_ID = new Map(DIRECTIONS.map((d) => [d.id, d]))

/** 방위 ID → 방위 정보. 목록 렌더의 반복 find 대신 O(1) 조회 (매핑 실패 시 북으로 폴백) */
export function directionOf(direction: DirectionId): DirectionInfo {
  return DIRECTION_BY_ID.get(direction) ?? DIRECTIONS[0]
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

  // ── 2026-08-03 보강 (34곳) ────────────────────────────────────────────────
  // 두 갈래를 함께 채웠다.
  //  1) docs/curation.md 큐레이션 표에 있으나 코드에 빠져 있던 20곳
  //  2) TourAPI에 areacode·sigungucode가 빈 문자열이라 areaBasedList2로는 조회 자체가
  //     불가능한 14곳 (태종대·용두산공원·국립해양박물관·임시수도기념관 등) —
  //     searchKeyword2 전국 검색으로만 나온다. 정적 풀에 넣지 않으면 앱에서 영영 안 보인다.
  // 좌표·구는 contentId로 detailCommon2를 실호출해 확인 (2026-08-03).
  // 방위·티어·스토리는 위 21곳과 동일하게 자체 큐레이션 값이다 (TourAPI overview 미사용).
  // 'curation.md 미수록 14곳'은 같은 날짜로 curation.md 표에도 행을 추가했다.
  // 북 — 중구 원도심 (용두산·대청동)
  {
    id: 'yongdusan-park', contentId: '126121', name: '용두산공원', category: '공원', district: '중구', direction: 'N', tier: 1, lat: 35.1004, lon: 129.0327,
    walkMinutes: 12, open: { known: true, text: '상시 개방' },
    story: '원도심 한복판에 솟은 언덕. 계단을 오르면 부산항이 펼쳐져요.',
  },
  {
    id: 'modern-history-annex', contentId: '2784363', name: '부산근현대역사관 별관', category: '근현대', district: '중구', direction: 'N', tier: 2, lat: 35.1027, lon: 129.0312,
    walkMinutes: 12, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '오래된 건물 안에서 도시의 시간을 천천히 읽는 곳.',
  },
  {
    id: 'democracy-park', contentId: '127149', name: '민주공원', category: '공원', district: '중구', direction: 'N', tier: 3, lat: 35.1094, lon: 129.0281,
    walkMinutes: 24, open: { known: true, text: '상시 개방' },
    story: '도시의 기억과 북항 풍경이 함께 머무는 언덕.',
  },
  {
    id: 'waegwan-site', contentId: '1942348', name: '관수옥과 초량왜관 터', category: '근현대', district: '중구', direction: 'N', tier: 3, lat: 35.1005, lon: 129.0327,
    walkMinutes: 12, open: { known: true, text: '상시 개방' },
    story: '초량왜관의 흔적을 따라 오래된 부산을 상상하는 자리.',
  },
  {
    id: 'baeksan-memorial', contentId: '130153', name: '백산기념관', category: '근현대', district: '중구', direction: 'N', tier: 3, lat: 35.1019, lon: 129.0346,
    walkMinutes: 16, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '독립운동 자금을 대던 백산상회 자리. 조용한 골목에 선 작은 기념관.',
  },
  // 북동 — 동구 산복도로·좌천·범일
  {
    id: 'namseon-warehouse', contentId: '1942299', name: '남선창고터', category: '근현대', district: '동구', direction: 'NE', tier: 3, lat: 35.1168, lon: 129.0395,
    walkMinutes: 46, open: { known: true, text: '상시 개방' },
    story: '부산역 뒤편에 남은 항구 도시의 첫 기억.',
  },
  {
    id: 'stairs-168', contentId: '1942337', name: '168계단', category: '산복도로', district: '동구', direction: 'NE', tier: 2, lat: 35.1171, lon: 129.0353,
    walkMinutes: 43, open: { known: true, text: '상시 개방' },
    story: '산복도로와 부두를 잇는 가파른 계단. 모노레일로 오를 수도 있어요.',
  },
  {
    id: 'kimminbu-view', contentId: '1942245', name: '김민부전망대', category: '전망', district: '동구', direction: 'NE', tier: 3, lat: 35.1177, lon: 129.0353,
    walkMinutes: 44, open: { known: true, text: '상시 개방' },
    story: '168계단 위에서 북항과 원도심을 마주 보는 작은 전망대.',
  },
  {
    id: 'janggiryeo-center', contentId: '1945293', name: '장기려기념 더 나눔센터', category: '전시', district: '동구', direction: 'NE', tier: 3, lat: 35.1186, lon: 129.0327,
    walkMinutes: 45, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '한 의사의 나눔 정신을 동네 안에서 만나는 공간.',
  },
  {
    id: 'ilsin-school', contentId: '1608673', name: '부산진일신여학교', category: '근현대', district: '동구', direction: 'NE', tier: 3, lat: 35.1349, lon: 129.0529,
    walkMinutes: 91, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '근대 교육과 독립운동의 기억이 고요히 남은 교정.',
  },
  {
    id: 'busanjin-market', contentId: '132189', name: '부산진시장', category: '시장', district: '동구', direction: 'NE', tier: 2, lat: 35.1362, lon: 129.0588,
    walkMinutes: 99, open: { known: false, text: '점포별 상이' },
    story: '세월을 품은 상가 사이로 부산의 생활이 흐르는 시장.',
  },
  {
    id: 'busanjin-fortress', contentId: '126830', name: '부산진성공원', category: '공원', district: '동구', direction: 'NE', tier: 3, lat: 35.1359, lon: 129.0611,
    walkMinutes: 101, open: { known: true, text: '상시 개방' },
    story: '자성대 언덕에 남은 옛 성터. 도심 속에서 조선의 흔적을 만나요.',
  },
  {
    id: 'tongsinsa-museum', contentId: '1756065', name: '조선통신사역사관', category: '전시', district: '동구', direction: 'NE', tier: 3, lat: 35.1357, lon: 129.0621,
    walkMinutes: 102, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '조선에서 일본으로 떠난 사절단의 길을 따라가는 전시관.',
  },
  // 동 — 중구 남측 해안
  {
    id: 'jagalchi-cruise', contentId: '3064821', name: '자갈치 크루즈', category: '해안', district: '중구', direction: 'E', tier: 2, lat: 35.0967, lon: 129.0317,
    walkMinutes: 10, open: { known: false, text: '운항 시간은 지도에서 확인' },
    story: '자갈치 앞바다에서 원도심의 윤곽을 새로 보는 시간.',
  },
  // 남동 — 영도 안쪽 (봉래·대평)
  {
    id: 'repair-shipyard-road', contentId: '1942253', name: '수리조선소길', category: '산업·예술', district: '영도구', direction: 'SE', tier: 3, lat: 35.0924, lon: 129.0335,
    walkMinutes: 18, open: { known: true, text: '상시 개방' },
    story: '배를 고치던 손길과 산업의 시간이 남아 있는 길.',
  },
  {
    id: 'namhang-market', contentId: '1942298', name: '남항시장', category: '시장', district: '영도구', direction: 'SE', tier: 3, lat: 35.0889, lon: 129.0423,
    walkMinutes: 34, open: { known: false, text: '점포별 상이' },
    story: '영도 초입에서 동네의 식탁과 일상을 만나는 시장.',
  },
  // 남 — 영도 남쪽·동쪽 해안 (흰여울·동삼·태종대)
  {
    id: 'jeoryeong-coast', contentId: '252561', name: '절영해안산책로', category: '해안', district: '영도구', direction: 'S', tier: 2, lat: 35.0812, lon: 129.0412,
    walkMinutes: 45, open: { known: true, text: '상시 개방' },
    story: '절벽 아래 파도와 나란히 오래 걸을 수 있는 해안길.',
  },
  {
    id: 'taejongdae', contentId: '126658', name: '태종대', category: '자연', district: '영도구', direction: 'S', tier: 1, lat: 35.0597, lon: 129.0798,
    walkMinutes: 126, open: { known: true, text: '상시 개방' },
    story: '기암절벽과 바다가 맞닿은 영도 남단. 등대까지 숲길이 이어져요.',
  },
  {
    id: 'gamji-beach', contentId: '2785289', name: '감지해변', category: '해변', district: '영도구', direction: 'S', tier: 3, lat: 35.0625, lon: 129.0765,
    walkMinutes: 117, open: { known: true, text: '상시 개방' },
    story: '태종대 곁에서 자갈과 파도 소리를 가까이 듣는 해변.',
  },
  {
    id: 'taejongsa', contentId: '1608751', name: '태종사', category: '사찰', district: '영도구', direction: 'S', tier: 2, lat: 35.0560, lon: 129.0898,
    walkMinutes: 144, open: { known: true, text: '상시 개방' },
    story: '숲과 수국 사이에서 잠시 호흡을 고르는 조용한 절.',
  },
  {
    id: 'maritime-museum', contentId: '1825843', name: '국립해양박물관', category: '전시', district: '영도구', direction: 'S', tier: 1, lat: 35.0785, lon: 129.0803,
    walkMinutes: 104, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '바다를 주제로 한 국내 최대 박물관. 배와 항해의 이야기가 모여 있어요.',
  },
  {
    id: 'amir-park', contentId: '2661446', name: '아미르공원', category: '공원', district: '영도구', direction: 'S', tier: 3, lat: 35.0772, lon: 129.0820,
    walkMinutes: 108, open: { known: true, text: '상시 개방' },
    story: '해양박물관 곁 바다를 낀 공원. 잔디밭 너머로 배가 지나가요.',
  },
  {
    id: 'plaza-75', contentId: '252564', name: '75광장', category: '해안', district: '영도구', direction: 'S', tier: 3, lat: 35.0706, lon: 129.0580,
    walkMinutes: 82, open: { known: true, text: '상시 개방' },
    story: '영도 동쪽 바다로 열린 광장. 해안도로 끝에서 수평선을 마주해요.',
  },
  // 남서 — 서구 송도·암남 해안
  {
    id: 'songdo-bolle-road', contentId: '2784356', name: '송도해안볼레길', category: '해안', district: '서구', direction: 'SW', tier: 3, lat: 35.0672, lon: 129.0189,
    walkMinutes: 69, open: { known: true, text: '상시 개방' },
    story: '붐비는 해변을 벗어나 조용한 해안으로 이어지는 산책길.',
  },
  {
    id: 'songdo-peninsula', contentId: '2614725', name: '송도반도 (부산 국가지질공원)', category: '자연', district: '서구', direction: 'SW', tier: 3, lat: 35.0660, lon: 129.0195,
    walkMinutes: 71, open: { known: true, text: '상시 개방' },
    story: '겹겹의 바위가 부산 바다의 오랜 시간을 들려주는 곳.',
  },
  {
    id: 'songdo-skywalk-bridge', contentId: '2684738', name: '송도용궁구름다리', category: '해안', district: '서구', direction: 'SW', tier: 2, lat: 35.0619, lon: 129.0220,
    walkMinutes: 79, open: { known: false, text: '운영시간은 지도에서 확인' },
    story: '암남공원 절벽과 작은 섬을 잇는 구름다리. 발밑으로 파도가 부서져요.',
  },
  {
    id: 'gongdong-fish-market', contentId: '1607655', name: '부산공동어시장', category: '시장', district: '서구', direction: 'SW', tier: 3, lat: 35.0887, lon: 129.0251,
    walkMinutes: 21, open: { known: false, text: '점포별 상이' },
    story: '새벽 경매 소리로 하루를 여는 국내 최대 산지 위판장.',
  },
  {
    id: 'nuribaragi-view', contentId: '2788424', name: '누리바라기전망대', category: '전망', district: '서구', direction: 'SW', tier: 3, lat: 35.0908, lon: 129.0203,
    walkMinutes: 20, open: { known: true, text: '상시 개방' },
    story: '서구 언덕 끝에서 남항과 영도를 한 화면에 담는 전망대.',
  },
  // 서 — 서구 내륙 (대신·구덕·부민)
  {
    id: 'cheonmasan-view', contentId: '2721158', name: '천마산하늘전망대', category: '전망', district: '서구', direction: 'W', tier: 3, lat: 35.0936, lon: 129.0173,
    walkMinutes: 19, open: { known: true, text: '상시 개방' },
    story: '천마산 위에서 항구와 산복도로를 함께 내려다보는 자리.',
  },
  {
    id: 'provisional-capital', contentId: '1608530', name: '임시수도기념관', category: '근현대', district: '서구', direction: 'W', tier: 2, lat: 35.1038, lon: 129.0176,
    walkMinutes: 20, open: { known: false, text: '운영시간·휴관일은 지도에서 확인' },
    story: '한국전쟁 시절 대통령 관저로 쓰인 집. 피란수도 부산의 1000일이 남아 있어요.',
  },
  // 북서 — 중구 서쪽 시장 (부평·자갈치·국제시장)
  {
    id: 'gukje-market', contentId: '132191', name: '국제시장', category: '시장', district: '중구', direction: 'NW', tier: 1, lat: 35.1016, lon: 129.0286,
    walkMinutes: 8, open: { known: false, text: '점포별 상이' },
    story: '서로 다른 골목이 한 장면처럼 이어지는 오래된 시장.',
  },
  {
    id: 'gukje-food-alley', contentId: '1018702', name: '국제시장 먹자골목', category: '시장', district: '중구', direction: 'NW', tier: 2, lat: 35.1011, lon: 129.0281,
    walkMinutes: 6, open: { known: false, text: '점포별 상이' },
    story: '시장 한복판에서 부산다운 한 끼를 고르는 골목.',
  },
  {
    id: 'yongdusan-jagalchi', contentId: '1957694', name: '용두산 자갈치 관광특구', category: '거리', district: '중구', direction: 'NW', tier: 1, lat: 35.0967, lon: 129.0306,
    walkMinutes: 8, open: { known: true, text: '상시 개방' },
    story: '시장과 바다, 광복로가 한 걸음에 이어지는 원도심의 중심.',
  },
  {
    id: 'art-street', contentId: '985921', name: '미술의거리', category: '거리', district: '중구', direction: 'NW', tier: 3, lat: 35.1006, lon: 129.0279,
    walkMinutes: 5, open: { known: true, text: '상시 개방' },
    story: '시장 곁 짧은 골목에서 일상의 작품을 만나는 길.',
  },
]

export interface Recommendation {
  direction: DirectionInfo
  candidates: Poi[]
  /** 후보 부족으로 인접 방위까지 넓힌 경우 (ui.md S3 — 사유 1줄 노출) */
  expandReason?: string
  /** 선택형 테마 스핀의 장면·미션 정보. 없으면 기존 기본 스핀. */
  theme?: import('../engine/themes').ThemeSpinResult
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
