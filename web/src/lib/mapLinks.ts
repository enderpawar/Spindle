const KAKAO_MAP_SEARCH_BASE = 'https://map.kakao.com/link/search/'
const KAKAO_MAP_DIRECTIONS_BASE = 'https://map.kakao.com/link/to/'

/** 장소명을 넘기면 카카오맵 검색 화면으로 바로 연결되는 외부 링크를 만든다. */
export function kakaoMapSearchUrl(placeName: string): string {
  return `${KAKAO_MAP_SEARCH_BASE}${encodeURIComponent(`부산 ${placeName}`)}`
}

/** 사용자 현재 위치 없이 POI 목적지만 넘기는 카카오맵 길찾기 링크. */
export function kakaoMapDirectionsUrl(placeName: string, lat: number, lon: number): string {
  return `${KAKAO_MAP_DIRECTIONS_BASE}${encodeURIComponent(placeName)},${lat},${lon}`
}
