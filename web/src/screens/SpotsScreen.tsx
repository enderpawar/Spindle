import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOldTownCongestionCached,
  localYyyymmdd,
  matchBusyPois,
  matchComfortablePois,
  type CongestionForecast,
} from '../api/congestion'
import { fetchExtraSpots, toDisplayPoi, type ExtraSpot } from '../api/extraSpots'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { MapView } from '../map/MapView'
import { directionOf, POI_POOL, type Departure, type Poi } from '../mock/pois'

const FILTERS = ['전체', '중구', '동구', '서구', '영도구']
const CURATED_CONTENT_IDS = new Set(POI_POOL.map((poi) => poi.contentId))

interface Props {
  departure: Departure
  onNavigate: (tab: NavTab) => void
  onSelect: (poi: Poi) => void
}

type CongestionLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; forecasts: CongestionForecast[] }
  | { status: 'error' }

function CongestionBadge() {
  return (
    <span className="congestion-badge">
      <span className="congestion-badge__mark" aria-hidden="true">!</span>
      오늘 혼잡 예상
    </span>
  )
}

function GoodToGoBadge() {
  return (
    <span className="good-to-go-badge">
      <span className="good-to-go-badge__mark" aria-hidden="true">✓</span>
      오늘 가기 좋아요
    </span>
  )
}

function CongestionStatus({ state, busyCount, goodCount, onRetry }: {
  state: CongestionLoadState
  busyCount: number
  goodCount: number
  onRetry: () => void
}) {
  if (state.status === 'error') {
    return (
      <div className="congestion-status congestion-status--error" role="alert">
        <span>혼잡 예측을 불러오지 못했어요</span>
        <button type="button" onClick={onRetry}>다시 시도</button>
      </div>
    )
  }
  if (state.status === 'loading') {
    return <div className="congestion-status" role="status">혼잡 예측 확인 중</div>
  }
  return (
    <div className="congestion-status" role="status">
      {goodCount > 0 && <GoodToGoBadge />}
      {busyCount > 0 && <CongestionBadge />}
      {goodCount === 0 && busyCount === 0 && '오늘 표시할 혼잡 예측 없음'}
    </div>
  )
}

/** 명소 탭 — 지도(기본)·리스트로 원도심·영도 POI 둘러보기 (Phase 2에서 areaBasedList2 연동) */
export function SpotsScreen({ departure, onNavigate, onSelect }: Props) {
  const [mode, setMode] = useState<'map' | 'list'>('map')
  const [filter, setFilter] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [extraSpots, setExtraSpots] = useState<ExtraSpot[] | null>(null)
  const [congestion, setCongestion] = useState<CongestionLoadState>({ status: 'loading' })
  const [congestionRetry, setCongestionRetry] = useState(0)
  const congestionDate = useMemo(() => localYyyymmdd(), [])

  useEffect(() => {
    let active = true
    setCongestion({ status: 'loading' })
    fetchOldTownCongestionCached(congestionDate)
      .then((forecasts) => {
        if (active) setCongestion({ status: 'loaded', forecasts })
      })
      .catch(() => {
        if (active) setCongestion({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [congestionDate, congestionRetry])

  useEffect(() => {
    let active = true
    fetchExtraSpots(CURATED_CONTENT_IDS)
      .then((spots) => {
        if (active) setExtraSpots(spots)
      })
      .catch((error: unknown) => {
        console.warn('[명소 지도] 전체 명소를 불러오지 못했습니다.', error)
      })
    return () => {
      active = false
    }
  }, [])

  const list = useMemo(() => {
    const pool = filter === '전체' ? POI_POOL : POI_POOL.filter((p) => p.district === filter)
    return [...pool].sort((a, b) => a.walkMinutes - b.walkMinutes)
  }, [filter])
  const filteredExtraSpots = useMemo(
    () => extraSpots?.filter((spot) => filter === '전체' || spot.district === filter) ?? [],
    [extraSpots, filter],
  )
  const extraDisplayPois = useMemo(
    () => filteredExtraSpots.map((spot) => toDisplayPoi(spot, departure)),
    [departure, filteredExtraSpots],
  )
  const congestionCandidates = useMemo(
    () => [
      ...POI_POOL,
      ...(extraSpots ?? []).map((spot) => toDisplayPoi(spot, departure)),
    ],
    [departure, extraSpots],
  )
  const busyByPoi = useMemo(
    () => congestion.status === 'loaded'
      ? matchBusyPois(congestionCandidates, congestion.forecasts, congestionDate)
      : new Map<string, CongestionForecast>(),
    [congestion, congestionCandidates, congestionDate],
  )
  const goodByPoi = useMemo(
    () => congestion.status === 'loaded'
      ? matchComfortablePois(congestionCandidates, congestion.forecasts, congestionDate)
      : new Map<string, CongestionForecast>(),
    [congestion, congestionCandidates, congestionDate],
  )
  const busyPoiIds = useMemo(() => new Set(busyByPoi.keys()), [busyByPoi])
  const goodPoiIds = useMemo(() => new Set(goodByPoi.keys()), [goodByPoi])
  const selectedExtraPoi = useMemo(
    () => extraDisplayPois.find((poi) => poi.id === selectedId) ?? null,
    [extraDisplayPois, selectedId],
  )

  // 필터가 바뀌어 선택 핀이 목록에서 빠지면 선택 해제
  useEffect(() => {
    if (
      selectedId
      && !list.some((poi) => poi.id === selectedId)
      && !filteredExtraSpots.some((spot) => spot.id === selectedId)
    ) {
      setSelectedId(null)
    }
  }, [filteredExtraSpots, list, selectedId])

  // ── 핀 → 카드 단방향 동기화 ──
  // 카드 스트립 스크롤은 지도를 움직이지 않는다(브라우즈 전용). 선택·지도 이동은
  // 핀 탭으로만 일어나며, 핀을 탭하면 해당 카드로 스트립을 스크롤해 준다.
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const pick = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    const el = cardRefs.current.get(id)
    const strip = stripRef.current
    if (el && strip) {
      strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
    }
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header className="spots-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px 0', zIndex: 5 }}>
        <div>
          <div className="spots-title" style={{ fontSize: 22, fontWeight: 900, color: 'var(--l-ink)' }}>명소 둘러보기</div>
          <div className="spots-subtitle" style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)' }}>원도심과 영도, {POI_POOL.length}곳의 이야기</div>
        </div>
        <div className="spots-view-toggle" style={{ display: 'flex', flex: 'none', padding: 3, gap: 2, borderRadius: 14, background: '#fff', boxShadow: '0 6px 14px -8px rgba(20,40,90,.25)' }}>
          {(
            [
              ['map', '지도'],
              ['list', '리스트'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="motion-card"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                borderRadius: 11,
                fontSize: 12.5,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                background: mode === m ? 'var(--l-primary)' : 'transparent',
                color: mode === m ? '#fff' : '#7089b8',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, padding: '9px 16px 8px', overflowX: 'auto', zIndex: 5 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`l-zone-chip ${f === filter ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {mode === 'map' ? (
        <>
          <div style={{ position: 'relative', flex: 1, borderRadius: '22px 22px 0 0', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)' }}>
          <MapView
            pois={list}
            departure={departure}
            selectedId={selectedId}
            busyPoiIds={busyPoiIds}
            goodPoiIds={goodPoiIds}
            extraSpots={filteredExtraSpots}
            onPick={pick}
            onOpen={onSelect}
          />
          <div className="map-status-stack">
            <CongestionStatus
              state={congestion}
              busyCount={busyPoiIds.size}
              goodCount={goodPoiIds.size}
              onRetry={() => setCongestionRetry((value) => value + 1)}
            />
            {extraSpots && (
              <div className="extra-spots-status" role="status">
                큐레이션 {POI_POOL.length}곳 + 관광공사 등록 명소 {extraSpots.length}곳
              </div>
            )}
          </div>

          {/* 하단 카드 스트립 — 브라우즈 전용. 스크롤해도 지도는 움직이지 않는다(핀 탭으로만 이동). */}
          <div
            ref={stripRef}
            className="no-scrollbar motion-card-list"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 'calc(24px + env(safe-area-inset-bottom))',
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              padding: '4px 32px 8px',
              zIndex: 10,
            }}
          >
            {list.map((poi) => {
              const dir = directionOf(poi.direction)
              const sel = poi.id === selectedId
              const busy = busyByPoi.has(poi.id)
              const good = goodByPoi.has(poi.id)
              return (
                <div
                  key={poi.id}
                  className="motion-card-enter"
                  ref={(el) => {
                    if (el) cardRefs.current.set(poi.id, el)
                    else cardRefs.current.delete(poi.id)
                  }}
                  style={{
                    flex: 'none',
                    width: 'calc(100% - 64px)',
                    scrollSnapAlign: 'center',
                    background: '#fff',
                    borderRadius: 20,
                    padding: '12px 14px',
                    boxShadow: sel ? '0 14px 30px -12px rgba(20,50,140,.4)' : '0 8px 20px -14px rgba(20,40,90,.3)',
                    border: sel ? `1.5px solid ${dir.color}` : '1.5px solid transparent',
                    transition: 'box-shadow .2s ease, border-color .2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: dir.color, flex: 'none' }} />
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                    {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
                  </div>
                  {busy && <CongestionBadge />}
                  {!busy && good && <GoodToGoBadge />}
                  <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {poi.story}
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={() => onSelect(poi)}
                    style={{ marginTop: 9, width: '100%', minHeight: 44, borderRadius: 13, fontSize: 13.5 }}
                  >
                    자세히 보기
                  </button>
                </div>
              )
            })}
          </div>
          {selectedExtraPoi && (() => {
            const dir = directionOf(selectedExtraPoi.direction)
            const busy = busyByPoi.has(selectedExtraPoi.id)
            const good = goodByPoi.has(selectedExtraPoi.id)
            return (
              <div
                className="extra-spot-card motion-card-enter"
                style={{
                  position: 'absolute',
                  left: 32,
                  right: 32,
                  bottom: 'calc(32px + env(safe-area-inset-bottom))',
                  zIndex: 11,
                  padding: '13px 14px 14px',
                  border: '1.5px solid rgba(127,156,199,.32)',
                  borderRadius: 20,
                  background: '#fff',
                  boxShadow: '0 14px 30px -12px rgba(20,50,140,.36)',
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedExtraPoi.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                  {selectedExtraPoi.category} · {selectedExtraPoi.district} · {dir.label}쪽 도보 {selectedExtraPoi.walkMinutes}분
                </div>
                {busy && <CongestionBadge />}
                {!busy && good && <GoodToGoBadge />}
                <button
                  className="btn btn-blue"
                  type="button"
                  onClick={() => onSelect(selectedExtraPoi)}
                  style={{ marginTop: 9, width: '100%', minHeight: 44, borderRadius: 13, fontSize: 13.5 }}
                >
                  자세히 보기
                </button>
              </div>
            )
          })()}
          </div>
          <SourceLine style={{ flex: 'none', margin: '4px 16px calc(82px + env(safe-area-inset-bottom))' }} />
        </>
      ) : (
        <div className="no-scrollbar motion-card-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(92px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CongestionStatus
            state={congestion}
            busyCount={busyPoiIds.size}
            goodCount={goodPoiIds.size}
            onRetry={() => setCongestionRetry((value) => value + 1)}
          />
          {list.map((poi) => {
            const dir = directionOf(poi.direction)
            const busy = busyByPoi.has(poi.id)
            const good = goodByPoi.has(poi.id)
            return (
              <button
                key={poi.id}
                onClick={() => onSelect(poi)}
                className="motion-card motion-card-enter"
                style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, background: '#fff', border: 'none', borderRadius: 20, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 76, height: 76, borderRadius: 16, flex: 'none', position: 'relative', overflow: 'hidden', background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 140%)`, display: 'grid', placeItems: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.6} aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.7)" />
                  </svg>
                  <PoiPhoto contentId={poi.contentId} alt={poi.name} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>                  </div>
                  <div style={{ marginTop: 3, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                    {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
                  </div>
                  {busy && <CongestionBadge />}
                  {!busy && good && <GoodToGoBadge />}
                  <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, fontWeight: 500, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{poi.story}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                  <path d="M9 6 l6 6 l-6 6" />
                </svg>
              </button>
            )
          })}
          <SourceLine />
        </div>
      )}

      <BottomNav active="spots" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
