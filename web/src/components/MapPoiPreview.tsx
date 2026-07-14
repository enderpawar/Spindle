import { PoiPhoto } from './PoiPhoto'
import type { Poi } from '../mock/pois'

interface Props {
  poi: Poi
  color: string
  onOpen?: (poi: Poi) => void
}

/** 선택 핀 위에 띄우는 관광 앱 스타일 대표 이미지 말풍선. */
export function MapPoiPreview({ poi, color, onOpen }: Props) {
  return (
    <button
      type="button"
      disabled={!onOpen}
      aria-hidden={!onOpen}
      aria-label={`${poi.name} 자세히 보기`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onOpen?.(poi)
      }}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 'clamp(148px, 42vw, 174px)',
        transform: 'translate(-50%, calc(-100% - 54px))',
        zIndex: 8,
        padding: 0,
        border: 0,
        background: 'none',
        cursor: onOpen ? 'pointer' : 'default',
        pointerEvents: onOpen ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '3 / 2',
          overflow: 'hidden',
          border: '4px solid #fff',
          borderRadius: 16,
          background: `linear-gradient(145deg, ${color}, #1e4fd8 135%)`,
          boxShadow: '0 12px 26px -8px rgba(18, 43, 104, .5)',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,.68)"
          strokeWidth={1.5}
          style={{ position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%,-50%)' }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.68)" />
        </svg>
        <PoiPhoto contentId={poi.contentId} alt="" scrim />
        <span
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 8,
            overflow: 'hidden',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 800,
            lineHeight: 1.25,
            textOverflow: 'ellipsis',
            textShadow: '0 1px 4px rgba(0,0,0,.5)',
            whiteSpace: 'nowrap',
          }}
        >
          {poi.name}
        </span>
      </div>

      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -6,
          width: 14,
          height: 14,
          borderRadius: 2,
          background: '#fff',
          boxShadow: '5px 5px 10px -7px rgba(18, 43, 104, .7)',
          transform: 'translateX(-50%) rotate(45deg)',
        }}
      />
    </button>
  )
}
