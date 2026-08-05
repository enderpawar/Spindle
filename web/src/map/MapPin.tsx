import type { Poi } from '../mock/pois'
import type { CongestionVisualStatus } from './congestionStatus'

/*
 * 지도 핀 — 큐레이션·전체 명소·코스 순번 핀이 모두 같은 물방울 하나를 쓴다.
 * 일반 명소는 종류·선택 상태와 무관하게 같은 크기를 쓴다.
 * 핀은 Spindle 블루로 통일하고, 혼잡·쾌적 배지만 의미색을 쓴다.
 */

/** 큐레이션·전체 명소가 함께 쓰는 기본 핀 너비. 선택해도 크기는 바뀌지 않는다. */
export const MAP_PIN_SIZE = 20
/** 숫자 가독성이 필요한 코스 순번 핀만 별도 규격을 쓴다. */
export const COURSE_PIN_SIZE = 26

/** 모든 기본 명소가 공유하는 저채도 Spindle 블루. */
export const DEFAULT_PIN_COLOR = '#5b7cb4'
export const SELECTED_PIN_COLOR = '#2f5cff'

export function pinColorOf(_poi: Poi): string {
  return DEFAULT_PIN_COLOR
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
  variant?: 'curated' | 'standard' | 'course'
  status?: CongestionVisualStatus
}

export function MapPin({ color, size, order, selected = false, label, variant = order === undefined ? 'standard' : 'course', status }: MapPinProps) {
  const displayColor = selected ? SELECTED_PIN_COLOR : color
  return (
    <>
      <svg
        className="map-pin__drop"
        data-pin-variant={variant}
        width={size}
        height={size * (32 / 24)}
        viewBox="0 0 24 32"
        style={{
          filter: selected
            ? `drop-shadow(0 6px 10px ${SELECTED_PIN_COLOR}66)`
            : 'drop-shadow(0 3px 6px rgba(25, 55, 130, .28))',
        }}
        aria-hidden
      >
        <path d={PIN_PATH} fill={displayColor} stroke="#fff" strokeWidth={selected ? 1.8 : 1.15} />
        {order === undefined ? (
          variant === 'curated' ? (
            <text x="12" y="16.1" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#fff">★</text>
          ) : (
            <circle cx="12" cy="12" r="3.7" fill="#fff" />
          )
        ) : (
          <text x="12" y="16.6" textAnchor="middle" fontSize="12.5" fontWeight="900" fill="#fff">
            {order}
          </text>
        )}
      </svg>
      {status && (
        <span
          className={`map-pin__status map-pin__status--${status}`}
          data-pin-status={status}
          style={{ left: size * 0.18, top: size * -1.35 }}
          aria-hidden="true"
        >
          {status === 'busy' ? '!' : '✓'}
        </span>
      )}
      {label && <span className={`map-pin__label${selected ? ' map-pin__label--on' : ''}`}>{label}</span>}
    </>
  )
}

export function MapClusterPin({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="map-cluster"
      aria-label={`${count}개 명소 묶음, 확대해서 보기`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <span>{count}</span>
    </button>
  )
}
