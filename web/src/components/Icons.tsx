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

/** 스핀 FAB — 바람개비형 8방위 별. 파란 원형 버튼 위 흰색으로 얹힌다. */
export function NavSpinIcon({ size = 28 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 1L14.03 7.43L13.79 9.35L19.78 4.22L16.67 10.21L15.14 11.39L23 12L16.57 14.03L14.65 13.79L19.78 19.78L13.79 16.67L12.61 15.14L12 23L9.97 16.57L10.21 14.65L4.22 19.78L7.33 13.79L8.86 12.61L1 12L7.43 9.97L9.35 10.21L4.22 4.22L10.21 7.33L11.39 8.86ZM12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

/**
 * 큐레이션 명소 핀 내부 도형 — 30×38 viewBox 안에 그린다.
 * 지도 위에서 배경과 붙지 않도록 몸통에 흰 테두리를 유지한다.
 */
export function CuratedPinShape({ color }: { color: string }) {
  return (
    <>
      <path
        d="M15 1.5A13.5 13.5 0 0 0 1.5 15c0 9.35 9.6 18.69 13.5 21.5 3.9-2.81 13.5-12.15 13.5-21.5A13.5 13.5 0 0 0 15 1.5Z"
        fill={color}
        stroke="#fff"
        strokeWidth={2.2}
      />
      <path
        d="m15 7.5 1.7 5.8 5.8 1.7-5.8 1.7-1.7 5.8-1.7-5.8L7.5 15l5.8-1.7L15 7.5Z"
        fill="#ffffff"
        stroke="#17347f"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
    </>
  )
}

/**
 * 일반 명소 핀 내부 도형 — 18×23 viewBox.
 * 속지가 `#17347f`인 이유는 주입되는 8방위 색이 밝은 파스텔이라 흰 점이 묻히기 때문이다.
 */
export function SpotPinShape({ color }: { color: string }) {
  return (
    <>
      <path
        d="M9 0.75A8.25 8.25 0 0 0 0.75 9c0 5.71 5.87 11.42 8.25 13.14 2.38-1.72 8.25-7.43 8.25-13.14A8.25 8.25 0 0 0 9 0.75Z"
        fill={color}
        stroke="#fff"
        strokeWidth={1.4}
      />
      <circle cx="9" cy="8.25" r="2.5" fill="#17347f" />
    </>
  )
}

/**
 * 8방위 나침반 로즈 — 스핀 원판 중앙에 얹는 대표 그래픽.
 * 긴 날 4개는 진한 잉크, 짧은 날 4개는 흐린 블루 (2톤 대비가 형태의 핵심).
 */
export function CompassRoseArt({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <path
        d="M93.94 26.06 57.88 52.22 67.78 62.12ZM93.94 93.94 67.78 57.88 57.88 67.78ZM26.06 93.94 62.12 67.78 52.22 57.88ZM26.06 26.06 52.22 62.12 62.12 52.22Z"
        fill="#8ba3cf"
      />
      <path
        d="M60 3 52 56 68 56ZM117 60 64 52 64 68ZM60 117 68 64 52 64ZM3 60 56 68 56 52Z"
        fill="#17347f"
      />
      <circle cx="60" cy="60" r="9" fill="#ffffff" stroke="#dbe6fa" strokeWidth={2} />
    </svg>
  )
}
