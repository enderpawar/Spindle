const KAKAO_MAP_SEARCH_BASE = 'https://map.kakao.com/link/search/'

/** 장소명을 넘기면 카카오맵 검색 화면으로 바로 연결되는 외부 링크를 만든다. */
export function kakaoMapSearchUrl(placeName: string): string {
  return `${KAKAO_MAP_SEARCH_BASE}${encodeURIComponent(`부산 ${placeName}`)}`
}
