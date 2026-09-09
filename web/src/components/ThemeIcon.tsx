import type { ThemeId } from '../engine/themes'

/** 테마 표식 선화 — ThemeNavigation(테마 필터 탭)과 홈 테마 카드가 공유하는 단일 소스. */
export function ThemeIcon({ id, size = 19 }: { id: ThemeId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === 'sea' && <path d="M3 8c3-4 6 4 9 0s6 4 9 0M3 13c3-4 6 4 9 0s6 4 9 0M3 18c3-4 6 4 9 0s6 4 9 0" />}
      {id === 'alley' && <path d="M3 10l2-6h14l2 6M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M5 13v7h14v-7M10 20v-5h4v5" />}
      {id === 'history' && <path d="M3 8l9-5 9 5H3ZM5 11v7M10 11v7M14 11v7M19 11v7M3 21h18" />}
      {id === 'night' && <><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /><path d="M17 3v4M15 5h4" /></>}
      {id === 'food' && <path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-4 3-4 8 0 9" />}
    </svg>
  )
}
