import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { failureCauseLine } from '../api/failureCopy'
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
  primeOperationInfo,
  subscribeOperationInfo,
} from '../api/details'
import { fetchExtraSpots, toDisplayPoi, type ExtraSpot } from '../api/extraSpots'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { SpotsCategoryNavigation } from '../components/SpotsCategoryNavigation'
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
import { useBackGuard } from '../navigation/useBackGuard'
import { directionOf, POI_POOL, type Departure, type Poi } from '../mock/pois'

const FILTERS = ['전체', '중구', '동구', '서구', '영도구']
const CATEGORY_FILTERS = ['전체', '음식점', '카페'] as const
type CategoryFilter = (typeof CATEGORY_FILTERS)[number]
const CURATED_CONTENT_IDS = new Set(POI_POOL.map((poi) => poi.contentId))
const EMPTY_STATUS_MAP = new Map<string, CongestionVisualStatus>()
/** 목록 예열 상한 — 운영 원문을 모르는 POI는 평상시 핀으로 보수 통과하므로 전량일 필요가 없다. */
const OPERATION_PRIME_LIMIT = 12

function RegionPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => { setOpen(false); trigger.current?.focus() }
  useBackGuard(open, close)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <div ref={root} className="spots-region-select" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <button ref={trigger} type="button" className={`spots-region-trigger ${open ? 'is-open' : ''}`}
        aria-label={`지역 선택: ${value === '전체' ? '모든 지역' : value}`}
        aria-expanded={open} aria-controls="spots-region-options" onClick={() => setOpen(!open)}>
        {value === '전체' ? '모든 지역' : value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div id="spots-region-options" className="spots-region-options" role="group" aria-label="지역 선택">
        <div className="spots-region-options__title">어디를 둘러볼까요?</div>
        {FILTERS.map((district) => (
          <button key={district} type="button" aria-pressed={district === value}
            onClick={() => { onChange(district); close() }}>
            <span>{district === '전체' ? '모든 지역' : district}</span>
            {district === value && <span className="spots-region-check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>}
    </div>
  )
}

interface Props {
  departure: Departure
  onNavigate: (tab: NavTab) => void
  onSelect: (poi: Poi) => void
}

type CongestionLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; forecasts: CongestionForecast[] }
  | { status: 'error'; error: unknown }

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
        <span>혼잡 예측을 불러오지 못했어요 · {failureCauseLine(state.error)}</span>
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
        <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: 'var(--l-ink-3)' }}>
        {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
      </div>
      {notice && (
        <div className="operation-notice" role="status">
          <span className="operation-notice__mark" aria-hidden="true">!</span>
          {notice}
        </div>
      )}
      {!notice && status && <CongestionBadge status={status} />}
      <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {summary ?? poi.story}
      </div>
    </>
  )
}

function PoiListCard({ poi, status, notice, onSelect }: {
  poi: Poi
  status?: CongestionVisualStatus
  notice?: string
  onSelect: (poi: Poi) => void
}) {
  const dir = directionOf(poi.direction)
  return (
    <button
      onClick={() => onSelect(poi)}
      className="motion-card motion-card-enter"
      style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, background: '#fff', border: 'none', borderRadius: 20, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
    >
      <div style={{ width: 76, height: 76, borderRadius: 16, flex: 'none', position: 'relative', overflow: 'hidden', background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 140%)`, display: 'grid', placeItems: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.6} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.7)" />
        </svg>
        <PoiPhoto contentId={poi.contentId} alt={poi.name} variant="thumb" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>
        </div>
        <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: 'var(--l-ink-3)' }}>
          {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
        </div>
        {notice && (
          <div className="operation-notice" role="status">
            <span className="operation-notice__mark" aria-hidden="true">!</span>
            {notice}
          </div>
        )}
        {!notice && status && <CongestionBadge status={status} />}
        <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, fontWeight: 500, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{poi.story}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
        <path d="M9 6 l6 6 l-6 6" />
      </svg>
    </button>
  )
}

export function filterCuratedPois(districtFilter: string, categoryFilter: CategoryFilter): Poi[] {
  if (categoryFilter !== '전체') return []
  const pool = districtFilter === '전체'
    ? POI_POOL
    : POI_POOL.filter((poi) => poi.district === districtFilter)
  return [...pool].sort((a, b) => a.walkMinutes - b.walkMinutes)
}

export function filterExtraSpots(
  spots: readonly ExtraSpot[] | null,
  districtFilter: string,
  categoryFilter: CategoryFilter,
): ExtraSpot[] {
  return spots?.filter((spot) => (
    (districtFilter === '전체' || spot.district === districtFilter)
    && (categoryFilter === '전체' || spot.category === categoryFilter)
  )) ?? []
}

export function SpotsListCards({ pois, statusByPoiId, closedNoticeByPoi, onSelect }: {
  pois: readonly Poi[]
  statusByPoiId: ReadonlyMap<string, CongestionVisualStatus>
  closedNoticeByPoi: ReadonlyMap<string, string>
  onSelect: (poi: Poi) => void
}) {
  return pois.map((poi) => (
    <PoiListCard
      key={poi.id}
      poi={poi}
      notice={closedNoticeByPoi.get(poi.id)}
      status={closedNoticeByPoi.has(poi.id) ? undefined : statusByPoiId.get(poi.id)}
      onSelect={onSelect}
    />
  ))
}

export function ExtraSpotsStatus({
  categoryFilter,
  extraSpots,
  error,
  retrying,
  curatedCount,
  filteredCount,
  onRetry,
}: {
  categoryFilter: CategoryFilter
  extraSpots: readonly ExtraSpot[] | null
  error: unknown
  retrying: boolean
  curatedCount: number
  filteredCount: number
  onRetry: () => void
}) {
  if (extraSpots !== null) {
    if (categoryFilter !== '전체' && filteredCount === 0) {
      return <div className="extra-spots-status" role="status">이 조건에 맞는 곳이 없어요</div>
    }
    return (
      <div className="extra-spots-status" role="status">
        {categoryFilter === '전체'
          ? `둘러볼 곳 ${curatedCount + filteredCount}곳`
          : `${categoryFilter} ${filteredCount}곳`}
      </div>
    )
  }
  if (retrying) {
    return <div className="extra-spots-status" role="status">관광공사 등록 명소를 다시 불러오는 중</div>
  }
  if (error !== null) {
    return (
      <div className="extra-spots-status extra-spots-status--error" role="alert">
        관광공사 등록 명소를 더 불러오지 못했어요 · {failureCauseLine(error)}
        <button type="button" onClick={onRetry}>다시 시도</button>
      </div>
    )
  }
  if (categoryFilter !== '전체') {
    return <div className="extra-spots-status" role="status">관광공사 등록 명소를 불러오는 중</div>
  }
  return null
}

/** 명소 탭 — 지도(기본)·리스트로 원도심·영도 POI 둘러보기 (Phase 2에서 areaBasedList2 연동) */
export function SpotsScreen({ departure, onNavigate, onSelect }: Props) {
  const [mode, setMode] = useState<'map' | 'list'>('map')
  const [filter, setFilter] = useState('전체')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [extraSpots, setExtraSpots] = useState<ExtraSpot[] | null>(null)
  const [extraSpotsError, setExtraSpotsError] = useState<unknown>(null)
  const [extraSpotsRetry, setExtraSpotsRetry] = useState(0)
  // 재시도 중에는 오류 줄이 잠깐 사라져 "눌러도 반응이 없는" 것처럼 보인다 — 진행 중임을 남긴다.
  const [extraSpotsRetrying, setExtraSpotsRetrying] = useState(false)
  const [congestion, setCongestion] = useState<CongestionLoadState>({ status: 'loading' })
  const [congestionRetry, setCongestionRetry] = useState(0)
  const congestionDate = useMemo(() => localYyyymmdd(), [])

  // 핀 시트가 열려 있으면 뒤로가기는 시트만 닫는다.
  // 시트는 지도 모드에서만 렌더된다 — 리스트로 바꿔도 selectedId는 남으므로, 모드까지 함께
  // 보지 않으면 보이지도 않는 상태를 닫느라 뒤로가기가 조용히 먹힌다.
  useBackGuard(mode === 'map' && selectedId !== null, () => setSelectedId(null))

  useEffect(() => {
    let active = true
    setCongestion({ status: 'loading' })
    fetchOldTownCongestionCached(congestionDate)
      .then((forecasts) => {
        if (active) setCongestion({ status: 'loaded', forecasts })
      })
      .catch((error: unknown) => {
        if (active) setCongestion({ status: 'error', error })
      })
    return () => {
      active = false
    }
  }, [congestionDate, congestionRetry])

  useEffect(() => {
    let active = true
    setExtraSpotsError(null)
    setExtraSpotsRetrying(extraSpotsRetry > 0)
    fetchExtraSpots(CURATED_CONTENT_IDS)
      .then((spots) => {
        if (!active) return
        setExtraSpots(spots)
        setExtraSpotsError(null)
      })
      .catch((error: unknown) => {
        console.warn('[명소 지도] 전체 명소를 불러오지 못했습니다.', error)
        // 조용히 큐레이션 35곳만 남기지 않는다 — 사유를 알리고 다시 시도할 길을 준다.
        // 재시도는 실패한 구만 다시 호출한다(성공한 구는 세션 캐시 히트).
        if (active) setExtraSpotsError(error)
      })
      .finally(() => {
        if (active) setExtraSpotsRetrying(false)
      })
    return () => {
      active = false
    }
  }, [extraSpotsRetry])

  const list = useMemo(
    () => filterCuratedPois(filter, categoryFilter),
    [categoryFilter, filter],
  )
  const filteredExtraSpots = useMemo(
    () => filterExtraSpots(extraSpots, filter, categoryFilter),
    [categoryFilter, extraSpots, filter],
  )
  const allExtraDisplayPois = useMemo(
    () => extraSpots?.map((spot) => toDisplayPoi(spot, departure)) ?? [],
    [departure, extraSpots],
  )
  const extraDisplayPois = useMemo(
    () => allExtraDisplayPois.filter((spot) => (
      (filter === '전체' || spot.district === filter)
      && (categoryFilter === '전체' || spot.category === categoryFilter)
    )),
    [allExtraDisplayPois, categoryFilter, filter],
  )
  const listDisplayPois = useMemo(
    () => categoryFilter === '전체' ? list : extraDisplayPois,
    [categoryFilter, extraDisplayPois, list],
  )
  // 세션 시작 전량 예열을 걷어낸 뒤의 대체 경로 — 명소 탭을 연 시점에, 지금 필터로
  // 화면에 뜬 목록의 앞쪽만 운영 원문을 데운다. 이미 알거나 예열 중인 POI는
  // primeOperationInfo가 거르므로 필터를 오가도 같은 POI를 다시 부르지 않는다.
  useEffect(() => {
    const ids = listDisplayPois
      .map((poi) => poi.contentId)
      .filter((id): id is string => !!id)
      .slice(0, OPERATION_PRIME_LIMIT)
    if (ids.length > 0) void primeOperationInfo(ids).catch(() => {})
  }, [listDisplayPois])

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
    () => categoryFilter === '전체'
      ? filterCongestionStatusMap(allStatusByPoiId, [...list, ...extraDisplayPois])
      : EMPTY_STATUS_MAP,
    [allStatusByPoiId, categoryFilter, extraDisplayPois, list],
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
      && !extraDisplayPois.some((poi) => poi.id === selectedId)
    ) {
      setSelectedId(null)
    }
  }, [extraDisplayPois, list, selectedId])

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
          <div className="spots-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--l-ink)' }}>명소 둘러보기</div>
          <div className="spots-subtitle" style={{ marginTop: 2, fontSize: 13, fontWeight: 500, color: 'var(--l-ink-3)' }}>부산 원도심과 영도, 취향 따라 발견</div>
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
              aria-pressed={mode === m}
              className="motion-card"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                borderRadius: 11,
                fontSize: 12.5,
                fontWeight: 700,
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

      <div className="spots-filter-bar spots-filter-bar--icons">
        <SpotsCategoryNavigation value={categoryFilter} onChange={setCategoryFilter} />
        <RegionPicker value={filter} onChange={setFilter} />
      </div>

      {mode === 'map' ? (
        <>
          {/* isolation: 지도 위 오버레이(혼잡 카드·시트 z-12)의 z-index를 이 영역 안에 가둔다.
              없으면 같은 쌓임 맥락의 필터 바(z-5)보다 위로 올라와 지역 드롭다운을 가린다. */}
          <div style={{ position: 'relative', flex: 1, borderRadius: '22px 22px 0 0', overflow: 'hidden', isolation: 'isolate', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)' }}>
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
            {categoryFilter === '전체' && <CongestionStatus
              state={congestion}
              busyCount={congestionCounts.busy}
              goodCount={congestionCounts.good}
              onRetry={() => setCongestionRetry((value) => value + 1)}
            />}
            <ExtraSpotsStatus
              categoryFilter={categoryFilter}
              extraSpots={extraSpots}
              error={extraSpotsError}
              retrying={extraSpotsRetrying}
              curatedCount={list.length}
              filteredCount={filteredExtraSpots.length}
              onRetry={() => setExtraSpotsRetry((value) => value + 1)}
            />
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
          {categoryFilter === '전체' && <CongestionStatus
            state={congestion}
            busyCount={congestionCounts.busy}
            goodCount={congestionCounts.good}
            onRetry={() => setCongestionRetry((value) => value + 1)}
          />}
          {categoryFilter !== '전체' && (
            <ExtraSpotsStatus
              categoryFilter={categoryFilter}
              extraSpots={extraSpots}
              error={extraSpotsError}
              retrying={extraSpotsRetrying}
              curatedCount={list.length}
              filteredCount={filteredExtraSpots.length}
              onRetry={() => setExtraSpotsRetry((value) => value + 1)}
            />
          )}
          <SpotsListCards
            pois={listDisplayPois}
            statusByPoiId={statusByPoiId}
            closedNoticeByPoi={closedNoticeByPoi}
            onSelect={onSelect}
          />
          <SourceLine />
        </div>
      )}

      <BottomNav active="spots" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
