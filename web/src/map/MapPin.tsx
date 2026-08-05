import { themesOf, type ThemeId } from '../engine/themes'
import type { Poi } from '../mock/pois'

/*
 * 지도 핀 — 큐레이션·전체 명소·코스 순번 핀이 모두 같은 물방울 하나를 쓴다.
 * 형태로 위계를 나누지 않고 크기와 색만 다르게 준다. 색은 방위가 아니라 테마로만 나뉜다.
 */

/**
 * 테마 팔레트(engine/themes)는 카드 배경용 파스텔이라 밝은 지도 위에서 흰 구멍이 묻는다.
 * 같은 색상환을 유지하되 지도에서 읽히는 채도로 내린 값을 핀 전용으로 둔다.
 */
const THEME_PIN_COLORS: Readonly<Record<ThemeId, string>> = {
  sea: '#1a8fd4',
  alley: '#e86a3c',
  history: '#6f57d8',
  night: '#2f5cff',
  food: '#cf9310',
}

/** 테마가 없는 관광공사 등록 명소 — 조용한 남색으로 큐레이션 핀 뒤에 물러난다. */
export const DEFAULT_PIN_COLOR = '#5b7cb4'

export function pinColorOf(poi: Poi): string {
  const [theme] = themesOf(poi)
  return theme ? THEME_PIN_COLORS[theme] : DEFAULT_PIN_COLOR
}

/** 물방울 핀 하나. 24×32 뷰박스, 꼭짓점이 (12, 31)에 온다. */
const PIN_PATH =
  'M12 1a11 11 0 0 0-11 11c0 7.1 8.9 17.3 10.2 18.7a1.1 1.1 0 0 0 1.6 0C14.1 29.3 23 19.1 23 12A11 11 0 0 0 12 1Z'

export interface MapPinProps {
  color: string
  /** 핀 너비(px). 높이는 4:3 비율로 따라간다. */
  size: number
  /** 코스 순번 — 주어지면 가운데 구멍 대신 번호가 들어간다. */
  order?: number
  selected?: boolean
  label?: string
}

export function MapPin({ color, size, order, selected = false, label }: MapPinProps) {
  return (
    <>
      <svg
        className="map-pin__drop"
        width={size}
        height={size * (32 / 24)}
        viewBox="0 0 24 32"
        style={{
          filter: selected
            ? `drop-shadow(0 6px 10px ${color}66)`
            : 'drop-shadow(0 3px 6px rgba(25, 55, 130, .28))',
        }}
        aria-hidden
      >
        <path d={PIN_PATH} fill={color} />
        {order === undefined ? (
          <circle cx="12" cy="12" r="4.2" fill="#fff" />
        ) : (
          <text x="12" y="16.6" textAnchor="middle" fontSize="12.5" fontWeight="900" fill="#fff">
            {order}
          </text>
        )}
      </svg>
      {label && <span className={`map-pin__label${selected ? ' map-pin__label--on' : ''}`}>{label}</span>}
    </>
  )
}
