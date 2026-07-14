/**
 * 길찾기 시트의 지도 앱 브랜드 아이콘 (카카오맵·네이버지도).
 * 외부 로고 이미지를 불러오지 않고 인라인 SVG로 그린다 (오프라인 셸·CSP 안전).
 * 각 앱의 상징 색·마크를 그대로 써 한눈에 어떤 앱으로 넘어가는지 알 수 있게 한다.
 */

/** 카카오 — 카카오톡 노란 배지 + 말풍선 마크 */
export function KakaoIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden focusable="false">
      <rect width="30" height="30" rx="9" fill="#FEE500" />
      <path
        d="M15 8 C10.58 8 7 10.79 7 14.23 c0 2.2 1.47 4.13 3.68 5.22 -.16 .58 -.58 2.15 -.67 2.49 -.1 .42 .15 .41 .32 .3 .13 -.09 2.13 -1.45 3 -2.04 .54 .08 1.1 .12 1.67 .12 4.42 0 8 -2.79 8 -6.23 C23 10.79 19.42 8 15 8 Z"
        fill="#3B1E1E"
      />
    </svg>
  )
}

/** 네이버 — 초록 배지 + 흰색 N 마크 */
export function NaverIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden focusable="false">
      <rect width="30" height="30" rx="9" fill="#03C75A" />
      <path d="M17.6 15.2 L12.2 8 H9 V22 H12.4 V14.8 L17.8 22 H21 V8 H17.6 Z" fill="#fff" />
    </svg>
  )
}
