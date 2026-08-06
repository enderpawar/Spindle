import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  fetchOldTownCongestionCached,
  localYyyymmdd,
  type CongestionForecast,
} from '../api/congestion'
import {
  fetchPoiCardDetailCached,
  firstSentence,
  getOperationInfo,
  getOperationInfoVersion,
  subscribeOperationInfo,
} from '../api/details'
import { fetchExtraSpots, toDisplayPoi, type ExtraSpot } from '../api/extraSpots'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { MapView } from '../map/MapView'
import {
  buildCongestionStatusMap,
  CONGESTION_STATUS_LABELS,
  filterCongestionStatusMap,
  type CongestionVisualStatus,
} from '../map/congestionStatus'
import { evaluateOperation } from '../engine/operation'
import { directionOf, POI_POOL, type Departure, type Poi } from '../mock/pois'

const FILTERS = ['전체', '중구', '동구', '서구', '영도구']
const CURATED_CONTENT_IDS = new Set(POI_POOL.map((poi) => poi.contentId))
const EMPTY_STATUS_MAP = new Map<string, CongestionVisualStatus>()

interface Props {
  departure: Departure
  onNavigate: (tab: NavTab) => void
  onSelect: (poi: Poi) => void
}

type CongestionLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; forecasts: CongestionForecast[] }
  | { status: 'error' }

function CongestionBadge({ status, count }: { status: CongestionVisualStatus; count?: number }) {
  return (
    <span className={`congestion-badge congestion-badge--${status}`}>
      <span className="congestion-badge__mark" aria-hidden="true">
        {status === 'busy' ? '!' : '✓'}
      </span>
      {CONGESTION_STATUS_LABELS[status]}
      {count !== undefined && <span className="congestion-badge__count">{count}</span>}
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
  if (busyCount === 0 && goodCount === 0) {
    return <div className="congestion-status" role="status">오늘 표시할 혼잡 예측 없음</div>
  }
  return (
    <div className="congestion-status congestion-status--loaded" role="status">
      <CongestionBadge status="good" count={goodCount} />
      <CongestionBadge status="busy" count={busyCount} />
    </div>
  )
}

function PoiCardBody({ poi, status, summary, notice }: {
  poi: Poi
  status?: CongestionVisualStatus
  summary?: string
  notice?: string
}) {
  const dir = directionOf(poi.direction)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dir.color, flex: 'none' }} />
        <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
        {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
      </div>
      {notice && (
        <div className="operation-notice" role="status">
          <span className="operation-notice__mark" aria-hidden="true">!</span>
          {notice}
        </div>
      )}
      {!notice && status && <CongestionBadge status={status} />}
      <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {summary ?? poi.story}
      </div>
    </>
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
  const allExtraDisplayPois = useMemo(
    () => extraSpots?.map((spot) => toDisplayPoi(spot, departure)) ?? [],
    [departure, extraSpots],
  )
  const extraDisplayPois = useMemo(
    () => allExtraDisplayPois.filter((spot) => filter === '전체' || spot.district === filter),
    [allExtraDisplayPois, filter],
  )
  const congestionCandidates = useMemo(
    () => [...POI_POOL, ...allExtraDisplayPois],
    [allExtraDisplayPois],
  )
  const allStatusByPoiId = useMemo(
    () => congestion.status === 'loaded'
      ? buildCongestionStatusMap(congestionCandidates, congestion.forecasts, congestionDate)
      : EMPTY_STATUS_MAP,
    [congestion, congestionCandidates, congestionDate],
  )
  const statusByPoiId = useMemo(
    () => filterCongestionStatusMap(allStatusByPoiId, [...list, ...extraDisplayPois]),
    [allStatusByPoiId, extraDisplayPois, list],
  )
  const congestionCounts = useMemo(() => {
    let busy = 0
    let good = 0
    for (const status of statusByPoiId.values()) {
      if (status === 'busy') busy += 1
      else good += 1
    }
    return { busy, good }
  }, [statusByPoiId])
  // 운영 원문은 세션 시작 예열·상세 조회로 나중에 채워지므로 세대 번호를 구독해 핀을 다시 그린다.
  // 아직 모르는 POI는 보수적 통과라 평상시 핀 그대로다.
  const operationVersion = useSyncExternalStore(subscribeOperationInfo, getOperationInfoVersion)
  const closedNoticeByPoi = useMemo(() => {
    void operationVersion
    const notices = new Map<string, string>()
    for (const poi of [...list, ...extraDisplayPois]) {
      if (!poi.contentId) continue
      const status = evaluateOperation(getOperationInfo(poi.contentId))
      if (status.score === 0 && status.notice) notices.set(poi.id, status.notice)
    }
    return notices
  }, [extraDisplayPois, list, operationVersion])
  const closedPoiIds = useMemo(() => new Set(closedNoticeByPoi.keys()), [closedNoticeByPoi])
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

  // ── 핀 탭 → 하단 시트 ──
  // 가로 카드 스트립을 두지 않는다. 지도는 어느 방향으로도 자유롭게 끌 수 있어야 하고,
  // 장소 정보는 핀을 탭했을 때만 하단 시트로 올라온다. 빈 바다를 탭하면 닫힌다.
  const pick = (id: string | null) => setSelectedId(id)

  const selectedPoi = useMemo(
    () => list.find((poi) => poi.id === selectedId) ?? selectedExtraPoi,
    [list, selectedExtraPoi, selectedId],
  )

  // 큐레이션 35곳은 손으로 쓴 한 줄 소개가 있지만, 관광공사 등록 명소는 소개가 없어
  // `toDisplayPoi`가 주소로 대체해 둔다. 시트를 열 때만 detailCommon2 개요를 실시간
  // 조회해 첫 문장으로 채운다 (세션 캐시 디듀프, 영속 저장 없음).
  const [spotSummary, setSpotSummary] = useState<{ id: string; text: string } | null>(null)
  const isExtraSelected = !!selectedPoi && !list.some((poi) => poi.id === selectedPoi.id)

  useEffect(() => {
    if (!selectedPoi || !isExtraSelected || !selectedPoi.contentId) {
      setSpotSummary(null)
      return
    }
    let active = true
    const { id, contentId } = selectedPoi
    fetchPoiCardDetailCached(contentId)
      .then((detail) => {
        const text = detail.overview ? firstSentence(detail.overview, 90) : ''
        if (active && text) setSpotSummary({ id, text })
      })
      .catch(() => {
        /* 개요 조회 실패는 주소 표시로 폴백한다 */
      })
    return () => {
      active = false
    }
  }, [isExtraSelected, selectedPoi])

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
            statusByPoiId={statusByPoiId}
            closedPoiIds={closedPoiIds}
            extraSpots={extraDisplayPois}
            onPick={pick}
            onOpen={onSelect}
            showSelectedPreview={false}
            selectionOffsetRatio={0.24}
          />
          <div className="spots-source-overlay">
            <SourceLine style={{ margin: 0, color: '#61789d', fontSize: 9.5, lineHeight: 1.25 }} />
          </div>
          <div className="map-status-stack">
            <CongestionStatus
              state={congestion}
              busyCount={congestionCounts.busy}
              goodCount={congestionCounts.good}
              onRetry={() => setCongestionRetry((value) => value + 1)}
            />
            {extraSpots && (
              <div className="extra-spots-status" role="status">
                큐레이션 {list.length}곳 + 관광공사 등록 명소 {filteredExtraSpots.length}곳
              </div>
            )}
          </div>

          {/*
            핀을 탭하면 하단 시트로 사진·요약이 올라온다. 가로 카드 스트립은 두지 않는다 —
            지도를 어느 방향으로도 자유롭게 끌 수 있어야 하고, 선택은 핀 탭으로만 일어난다.
            지도는 선택 핀을 시트 위쪽 가운데로 부드럽게 정렬한다(selectionOffsetRatio).
          */}
          {selectedPoi && (
            <section key={selectedPoi.id} className="spot-sheet no-scrollbar" aria-live="polite">
              <button type="button" className="spot-sheet__close" onClick={() => pick(null)} aria-label="닫기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden>
                  <path d="M6 6 L18 18 M18 6 L6 18" />
                </svg>
              </button>
              <div
                className="spot-sheet__photo"
                style={{ background: `linear-gradient(145deg, ${directionOf(selectedPoi.direction).color}, #1e4fd8 135%)` }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,.68)"
                  strokeWidth={1.5}
                  style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.68)" />
                </svg>
                <PoiPhoto contentId={selectedPoi.contentId} alt={selectedPoi.name} scrim />
              </div>
              <div className="spot-sheet__body">
                <PoiCardBody
                  poi={selectedPoi}
                  status={statusByPoiId.get(selectedPoi.id)}
                  summary={spotSummary?.id === selectedPoi.id ? spotSummary.text : undefined}
                  notice={closedNoticeByPoi.get(selectedPoi.id)}
                />
                <button className="btn btn-blue spot-sheet__cta" onClick={() => onSelect(selectedPoi)}>
                  자세히 보기
                </button>
              </div>
            </section>
          )}
          </div>
        </>
      ) : (
        <div className="no-scrollbar motion-card-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(var(--nav-h, calc(88px + env(safe-area-inset-bottom))) + 16px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CongestionStatus
            state={congestion}
            busyCount={congestionCounts.busy}
            goodCount={congestionCounts.good}
            onRetry={() => setCongestionRetry((value) => value + 1)}
          />
          {list.map((poi) => {
            const dir = directionOf(poi.direction)
            const notice = closedNoticeByPoi.get(poi.id)
            const status = notice ? undefined : statusByPoiId.get(poi.id)
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
                  {notice && (
                    <div className="operation-notice" role="status">
                      <span className="operation-notice__mark" aria-hidden="true">!</span>
                      {notice}
                    </div>
                  )}
                  {status && <CongestionBadge status={status} />}
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
