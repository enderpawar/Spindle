const KAKAO_MAP_SEARCH_BASE = 'https://map.kakao.com/link/search/'
const KAKAO_MAP_DIRECTIONS_BASE = 'https://map.kakao.com/link/to/'
const KAKAO_MAP_COURSE_WALK_BASE = 'https://map.kakao.com/link/by/walk/'

/** 장소명을 넘기면 카카오맵 검색 화면으로 바로 연결되는 외부 링크를 만든다. */
export function kakaoMapSearchUrl(placeName: string): string {
  return `${KAKAO_MAP_SEARCH_BASE}${encodeURIComponent(`부산 ${placeName}`)}`
}

/** 사용자 현재 위치 없이 POI 목적지만 넘기는 카카오맵 길찾기 링크. */
export function kakaoMapDirectionsUrl(placeName: string, lat: number, lon: number): string {
  return `${KAKAO_MAP_DIRECTIONS_BASE}${encodeURIComponent(placeName)},${lat},${lon}`
}

/** 코스 링크에 넘길 공개 관광지 한 곳 — 이름과 POI 좌표만 담는다. */
export interface CourseWaypoint {
  name: string
  lat: number
  lon: number
}

/** 좌표가 비었거나 (0,0)·범위 밖이면 코스 링크에서 제외한다 (docs/course.md §7). */
function hasUsableCoords(point: CourseWaypoint): boolean {
  const { lat, lon } = point
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (lat === 0 && lon === 0) return false
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

/**
 * 확정 코스의 방문 순서를 그대로 넘기는 카카오맵 도보 길찾기 링크 (docs/course.md §7).
 *
 * 공개 관광지의 이름·좌표·순서만 URL에 담는다 — 사용자 GPS, 기기 방위각, GPS 정확도,
 * demo 가상 위치, 선택 출발점 좌표는 절대 포함하지 않는다 (AGENTS.md 절대 원칙 1).
 * 경로 계산·재탐색·안내는 이동한 카카오맵이 담당하고, Spindle은 경로 API를 호출하지 않는다.
 *
 * 좌표가 없는 장소를 제외한 뒤 2곳 미만이면 `null`을 돌려주고 화면은 CTA를 숨긴다.
 */
export function kakaoMapCourseWalkUrl(stops: CourseWaypoint[]): string | null {
  const usable = stops.filter(hasUsableCoords)
  if (usable.length < 2) return null
  const path = usable.map((s) => `${encodeURIComponent(s.name)},${s.lat},${s.lon}`).join('/')
  return `${KAKAO_MAP_COURSE_WALK_BASE}${path}`
}
