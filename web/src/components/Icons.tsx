/**
 * UI 아이콘 — 원본 SVG는 `web/src/assets/icons/`에 있고 이 파일이 JSX 사본이다.
 *
 * `<img src>`로 불러오면 `currentColor`가 죽어 활성/비활성·8방위 색 주입이 안 되므로
 * 인라인으로 쓴다. 원본 SVG를 고치면 여기도 함께 고칠 것 — 원본이 디자인 소스다.
 * 색·형태 규칙은 `web/src/assets/icons/README.md` 참고.
 */

interface NavIconProps {
  size?: number
}

/** 네비 아이콘 공통 — 색은 호출부가 `color`로 준다(currentColor 상속) */
function navSvgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function NavHomeIcon({ size = 24 }: NavIconProps) {
  return (
    <svg {...navSvgProps(size)}>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  )
}

export function NavSpotsIcon({ size = 24 }: NavIconProps) {
  return (
    <svg {...navSvgProps(size)}>
      <path d="M12 21s6-5.38 6-11a6 6 0 1 0-12 0c0 5.62 6 11 6 11Z" />
      <path d="m12 7 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
    </svg>
  )
}

export function NavStampIcon({ size = 24 }: NavIconProps) {
  return (
    <svg {...navSvgProps(size)}>
      <path d="M10 3h4" />
      <path d="M12 3v5" />
      <path d="M8 8h8l2 7H6l2-7Z" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function NavSettingsIcon({ size = 24 }: NavIconProps) {
  return (
    <svg {...navSvgProps(size)}>
      <path d="M4 8h3m4 0h9" />
      <circle cx="9" cy="8" r="2" />
      <path d="M4 16h9m4 0h3" />
      <circle cx="15" cy="16" r="2" />
    </svg>
  )
}
