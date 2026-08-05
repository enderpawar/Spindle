import { useCallback, useMemo, useState } from 'react'
import { ScreenFrame } from '../components/ScreenFrame'
import type { GeoPoint } from '../engine/geo'
import { pickedOriginFrom } from '../engine/origins'
import { ZONES, zoneOf } from '../engine/zones'
import { MapPin } from '../map/MapPin'
import { MapView } from '../map/MapView'
import type { Departure } from '../mock/pois'
import { getCurrentFix, GeoFixError } from '../sensors/geolocation'

interface Props {
  /** 지도를 열 기준점 — 지금 선택돼 있는 출발점 */
  origin: Departure
  onConfirm: (departure: Departure) => void
  onBack: () => void
}

/**
 * 지도에서 스핀 출발 좌표를 직접 찍는 화면.
 * 지도를 끌면 화면 중앙(십자 핀)이 곧 후보 좌표다. 좌표는 존 판정·추천 계산에만
 * 단말 안에서 쓰이고 어떤 요청·저장소에도 실리지 않는다 (AGENTS.md 절대 원칙 1).
 */
export function OriginPickScreen({ origin, onConfirm, onBack }: Props) {
  // 지도 초기 중심 — 팬 중에도 바뀌지 않게 첫 값으로 고정한다.
  const anchor = useMemo(() => origin, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [point, setPoint] = useState<GeoPoint>({ lat: origin.lat, lng: origin.lon })
  const [focusPoint, setFocusPoint] = useState<GeoPoint | null>(null)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handlePoint = useCallback((next: GeoPoint) => setPoint(next), [])

  const zone = ZONES.find((z) => z.id === zoneOf(point)) ?? null

  const locateMe = async () => {
    setNotice(null)
    setLocating(true)
    try {
      const fix = await getCurrentFix()
      setFocusPoint(fix)
    } catch (error) {
      setNotice(error instanceof GeoFixError && error.kind === 'denied'
        ? '위치 권한이 거부돼 내 위치로 이동할 수 없어요. 지도를 직접 움직여 골라 주세요.'
        : '현재 위치를 확인하지 못했어요. 지도를 직접 움직여 골라 주세요.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px', zIndex: 5 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--l-ink)' }}>지도에서 출발점 고르기</span>
      </header>

      <div style={{ position: 'relative', flex: 1, borderRadius: '22px 22px 0 0', overflow: 'hidden' }}>
        <MapView
          pois={[]}
          departure={anchor}
          selectedId={null}
          onPick={() => {}}
          showSelectedPreview={false}
          pickMode
          onPickPoint={handlePoint}
          focusPoint={focusPoint}
        />
        <div className="origin-pick__crosshair" aria-hidden>
          <span className="origin-pick__crosshair-shadow" />
          <MapPin color="#2f5cff" size={26} selected />
        </div>
        <button
          type="button"
          className="l-icon-btn origin-pick__locate"
          aria-label="내 위치로 이동"
          onClick={locateMe}
          disabled={locating}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.4" />
            <circle cx="12" cy="12" r="7.6" />
            <path d="M12 1.6 v3 M12 19.4 v3 M1.6 12 h3 M19.4 12 h3" />
          </svg>
        </button>
      </div>

      <section className="origin-pick__sheet" aria-live="polite">
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--l-ink)' }}>
          {zone ? `${zone.name} 근처` : '권역 밖이에요'}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.6, fontWeight: 600, color: 'var(--l-ink-3)' }}>
          {zone
            ? '지도를 움직여 핀 끝을 출발하고 싶은 자리에 두세요. 이 좌표는 단말 안에서만 쓰여요.'
            : 'Spindle은 부산 원도심과 영도를 안내해요. 권역 안 지점으로 옮겨 주세요.'}
        </p>
        {notice && (
          <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.55, fontWeight: 600, color: 'var(--l-ink-2)' }}>
            {notice}
          </p>
        )}
        <button
          className="btn btn-blue"
          style={{ marginTop: 14, width: '100%' }}
          disabled={!zone}
          onClick={() => onConfirm(pickedOriginFrom(point))}
        >
          여기서 출발하기
        </button>
      </section>
    </ScreenFrame>
  )
}
