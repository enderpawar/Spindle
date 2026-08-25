import { useEffect, useRef, useState } from 'react'
import { MapFallbackNote } from '../components/MapFallbackNote'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { StampNotice } from '../components/StampNotice'
import { MapView } from '../map/MapView'
import { kakaoMapCourseWalkUrl, kakaoMapDirectionsUrl, kakaoMapFirstStopDirectionsUrl } from '../lib/mapLinks'
import { markVisited, useVisited } from '../lib/visited'
import { useBackGuard } from '../navigation/useBackGuard'
import type { Departure } from '../mock/pois'
import type { CourseStopView, ReadyCourse } from '../engine/spinCourse'

interface Props {
  course: ReadyCourse
  /** 지도 출발 마커·첫 구간 라벨용 출발점 */
  departure: Departure
  onBack: () => void
  onRespin: () => void
}

/**
 * 코스 안내 단계 — Spindle은 경로를 계산하지 않고 "지금 어디로 갈 차례인지"만 단계로 끊는다.
 * idle: 코스 미리보기 / first: 1번 장소로 이동 중 / course: 1번 도착 후 전체 코스 이동 중
 */
type GuideStage = 'idle' | 'first' | 'course'

/**
 * 안내 단계의 CTA는 POI 카드와 **다른 키**를 쓴다.
 * 같은 키를 쓰면 1단계에서 길찾기를 누른 뒤 안내를 닫았을 때, 누른 적 없는 스트립 카드에도
 * 폴백 한 줄이 돋아난다 (그리고 flex 카드가 모두 늘어나 위 지도가 줄어든다).
 */
const COURSE_LINK_ID = '__course__'
const FIRST_STOP_LINK_ID = '__first-stop__'

/** 이동수단별 라벨 (zones.ts TravelEstimate.method) */
const METHOD_LABEL: Record<CourseStopView['method'], string> = {
  walk: '도보',
  bridge: '다리 건너',
  transit: '버스·지하철',
  estimate: '이동',
}

/**
 * 방향 기반 여행 코스 화면 (docs/course.md) — 단일 추천 카드의 [이 방향으로 코스 짜기]에서 진입.
 * 코스를 세로 카드로 나열하지 않고 지도 위 경로(출발→순서대로)로 미리보기한다.
 * 하단 카드 스트립과 지도 핀은 서로 선택을 동기화하며, 각 장소 길찾기 딥링크를 제공한다.
 * 코스는 engine/spinCourse에서 단말 내 계산으로 만들어지며, 여기서는 표시와 길찾기만 담당한다.
 */
export function CourseScreen({ course, departure, onBack, onRespin }: Props) {
  const { direction, stops, totalMinutes, reasons } = course
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stampToast, setStampToast] = useState<string | null>(null)
  const [stage, setStage] = useState<GuideStage>('idle')
  // 카카오맵 링크를 실제로 누른 장소만 폴백 한 줄을 띄운다 (MapFallbackNote 주석).
  const [triedMapIds, setTriedMapIds] = useState<readonly string[]>([])
  const markMapTried = (id: string) => setTriedMapIds((prev) => (prev.includes(id) ? prev : [...prev, id]))

  // 안내 단계가 열려 있으면 뒤로가기는 '안내 종료'와 같게 동작한다.
  useBackGuard(stage !== 'idle', () => setStage('idle'))
  const visited = useVisited()
  const firstStop = stops[0]

  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const courseOrder = stops.map((s) => s.poi.id)
  const stopPois = stops.map((s) => s.poi)
  // 코스 단위 길찾기는 카카오맵에 위임한다 (docs/course.md §7).
  // 공개 관광지 이름·좌표·순서만 넘기고 출발점·현재 위치·방위각은 넘기지 않는다.
  // 좌표가 유효한 장소가 2곳 미만이면 null → 장소별 [카카오맵 길찾기]만 남긴다.
  const courseWalkHref = kakaoMapCourseWalkUrl(
    stops.map((s) => ({ name: s.poi.name, lat: s.poi.lat, lon: s.poi.lon })),
  )
  const firstStopDirectionsHref = kakaoMapFirstStopDirectionsUrl(
    stops.map((s) => ({ name: s.poi.name, lat: s.poi.lat, lon: s.poi.lon })),
  )

  useEffect(() => {
    if (!stampToast) return
    const timer = setTimeout(() => setStampToast(null), 2600)
    return () => clearTimeout(timer)
  }, [stampToast])

  // 지도 핀을 탭해 선택이 바뀌면 하단 카드 스트립을 해당 카드로 스크롤 (양방향 동기화)
  useEffect(() => {
    if (!selectedId) return
    const el = cardRefs.current.get(selectedId)
    const strip = stripRef.current
    if (el && strip) {
      strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
    }
  }, [selectedId])

  // 길찾기(=방문 의사)에서 도장을 획득한다 — 결과 카드와 동일한 규칙.
  const recordNavigation = (stop: CourseStopView) => {
    setStampToast(null)
    if (markVisited(stop.poi.id)) {
      setStampToast(stop.poi.district)
    }
  }

  // 1번 장소 도착은 센서가 아니라 사용자가 직접 확인한다 — GPS를 읽지 않으므로 좌표 무전송 구조를 유지한다.
  const confirmFirstArrival = () => {
    if (firstStop) recordNavigation(firstStop)
    setSelectedId(stops[1]?.poi.id ?? null)
    setStage('course')
  }

  const legLabel = (stop: CourseStopView) =>
    stop.order === 1
      ? `${departure.name}에서 ${METHOD_LABEL[stop.method]} 약 ${stop.legMinutes}분 · 근사치`
      : `직전 장소에서 ${METHOD_LABEL[stop.method]} 약 ${stop.legMinutes}분 · 근사치`

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 8px', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--l-ink)' }}>{direction.label}쪽 코스</div>
        <div style={{ width: 40 }} />
      </header>

      {/* 지도 미리보기 — 코스 경로(출발→순서대로)를 지도 위에 그린다 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <MapView pois={stopPois} departure={departure} selectedId={selectedId} onPick={setSelectedId} courseOrder={courseOrder} />
        <div style={{ position: 'absolute', left: 16, top: 14, display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 14, background: 'rgba(255,255,255,.94)', boxShadow: '0 6px 16px -8px rgba(20,40,90,.35)' }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--l-ink)' }}>{stops.length}곳 코스</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--l-ink-3)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--l-ink-3)' }}>총 약 {totalMinutes}분 · 근사치</span>
        </div>
      </div>

      {/* 확장·축소 사유 (있을 때만, 배지 없이 담백한 텍스트) */}
      {reasons.length > 0 && (
        <div style={{ flex: 'none', padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {reasons.map((reason) => (
            <div key={reason} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--l-ink-3)' }}>· {reason}</div>
          ))}
        </div>
      )}

      {/* 코스 카드 스트립 — 지도 핀과 선택을 동기화. 스와이프해 순서대로 훑어본다 */}
      <div
        ref={stripRef}
        className="no-scrollbar motion-card-list"
        style={{ flex: 'none', display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '12px 20px 12px' }}
      >
        {stops.map((stop) => {
          const sel = stop.poi.id === selectedId
          const done = visited.has(stop.poi.id)
          return (
            <div
              key={stop.poi.id}
              className="motion-card motion-card-enter"
              ref={(el) => {
                if (el) cardRefs.current.set(stop.poi.id, el)
                else cardRefs.current.delete(stop.poi.id)
              }}
              onClick={() => setSelectedId(stop.poi.id)}
              style={{
                flex: 'none',
                width: 'calc(100% - 64px)',
                scrollSnapAlign: 'center',
                background: '#fff',
                borderRadius: 18,
                overflow: 'hidden',
                cursor: 'pointer',
                border: sel ? `1.5px solid ${direction.color}` : '1.5px solid var(--l-line)',
                boxShadow: sel ? '0 12px 26px -14px rgba(20,50,140,.4)' : '0 8px 20px -16px rgba(20,40,90,.3)',
                transition: 'border-color .2s ease, box-shadow .2s ease',
              }}
            >
              {/* 장소 사진 — 번호만 보여주지 않고 대표 사진을 먼저 (없으면 방위색 폴백) */}
              <div style={{ position: 'relative', height: 100, overflow: 'hidden', background: `linear-gradient(150deg, ${direction.color}, #1e4fd8 140%)` }}>
                <PoiPhoto contentId={stop.poi.contentId} alt={stop.poi.name} scrim />
                <span style={{ position: 'absolute', top: 10, left: 10, minWidth: 24, height: 24, padding: '0 8px', borderRadius: 12, background: 'rgba(15,37,64,.82)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 900 }}>
                  {stop.order}
                </span>
                {done && (
                  <span style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', background: 'rgba(15,37,64,.82)', display: 'grid', placeItems: 'center' }} aria-label="방문함">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                      <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
                    </svg>
                  </span>
                )}
              </div>

              <div style={{ padding: '11px 14px 13px' }}>
                <div style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.poi.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                  {stop.poi.category} · {stop.poi.district}
                </div>
                <div style={{ marginTop: 3, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>{legLabel(stop)}</div>
                <a
                  href={kakaoMapDirectionsUrl(stop.poi.name, stop.poi.lat, stop.poi.lon)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.stopPropagation()
                    recordNavigation(stop)
                    markMapTried(stop.poi.id)
                  }}
                  className="btn"
                  style={{ marginTop: 11, height: 42, width: '100%', background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-primary)', fontSize: 13.5, textDecoration: 'none' }}
                >
                  카카오맵 길찾기
                </a>
                <MapFallbackNote placeName={stop.poi.name} visible={triedMapIds.includes(stop.poi.id)} />
              </div>
            </div>
          )
        })}
      </div>

      {/*
        코스 안내는 두 단계로만 끊는다 (docs/course.md §7).
        1단계 = 1번 장소로 이동, 2단계 = 1번부터 전체 코스 이동.
        단계 전환은 사용자 확인으로만 일어나고, 실제 경로 계산·재탐색·도착 판정은 카카오맵이 맡는다.
      */}
      {stage !== 'idle' && (
        <section
          aria-live="polite"
          style={{ flex: 'none', margin: '0 20px 8px', padding: '13px 15px 15px', borderRadius: 18, background: '#fff', border: '1.5px solid var(--l-line)', boxShadow: '0 10px 24px -18px rgba(20,40,90,.4)' }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 900, color: 'var(--l-primary)' }}>{stage === 'first' ? '1단계' : '2단계'}</span>
            <strong style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--l-ink)' }}>
              {stage === 'first' ? `${firstStop?.poi.name ?? '1번 장소'}로 이동` : '코스 순서대로 이동'}
            </strong>
          </div>

          {stage === 'first' ? (
            <>
              <p style={{ margin: '6px 0 11px', fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: 'var(--l-ink-3)' }}>
                {firstStopDirectionsHref
                  ? '카카오맵에서 1번 장소까지 안내받으세요. 출발지는 카카오맵이 직접 잡습니다.'
                  : '1번 장소의 좌표가 없어 길찾기 링크를 만들지 못했어요. 아래 카드의 장소명으로 검색해 주세요.'}
              </p>
              {firstStopDirectionsHref && firstStop && (
                <a
                  href={firstStopDirectionsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  onClick={() => {
                    recordNavigation(firstStop)
                    markMapTried(FIRST_STOP_LINK_ID)
                  }}
                  style={{ height: 48, width: '100%', background: 'var(--l-primary)', color: '#fff', fontSize: 14, textDecoration: 'none' }}
                >
                  카카오맵으로 길찾기
                </a>
              )}
              {firstStop && (
                <MapFallbackNote placeName={firstStop.poi.name} visible={triedMapIds.includes(FIRST_STOP_LINK_ID)} />
              )}
              <button
                type="button"
                className="btn"
                onClick={confirmFirstArrival}
                style={{ marginTop: 8, height: 46, width: '100%', background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-primary)', fontSize: 13.5 }}
              >
                도착했어요 · 다음 단계로
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: '6px 0 11px', fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: 'var(--l-ink-3)' }}>
                {courseWalkHref
                  ? `이제 ${stops.length}곳을 순서대로 둘러보세요. 카카오맵이 1번부터의 방문 순서를 이어서 안내합니다.`
                  : '좌표가 있는 장소가 부족해 전체 코스 링크를 만들지 못했어요. 아래 카드에서 장소별로 길찾기를 이용해 주세요.'}
              </p>
              {courseWalkHref && (
                <a
                  href={courseWalkHref}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  onClick={() => markMapTried(COURSE_LINK_ID)}
                  style={{ height: 48, width: '100%', background: 'var(--l-primary)', color: '#fff', fontSize: 14, textDecoration: 'none' }}
                >
                  카카오맵에서 전체 코스 보기
                </a>
              )}
              {/* 전체 코스 링크가 열리지 않으면 1번 장소부터 모바일 웹으로 이어 간다 */}
              {firstStop && (
                <MapFallbackNote placeName={firstStop.poi.name} visible={triedMapIds.includes(COURSE_LINK_ID)} />
              )}
              <button
                type="button"
                className="btn"
                onClick={() => setStage('first')}
                style={{ marginTop: 8, height: 46, width: '100%', background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-ink-3)', fontSize: 13.5 }}
              >
                1단계로 돌아가기
              </button>
            </>
          )}
        </section>
      )}

      {stage === 'idle' && (
        <p style={{ flex: 'none', margin: '0 20px 6px', color: 'var(--l-ink-3)', fontSize: 11.5, fontWeight: 600 }}>
          안내를 시작하면 1번 장소까지 먼저 이동한 뒤, 도착을 확인하고 전체 코스로 넘어가요.
        </p>
      )}
      <SourceLine style={{ flex: 'none', margin: '0 20px 4px' }} />

      {stampToast && (
        <div style={{ flex: 'none', margin: '0 20px 8px' }}>
          <StampNotice district={stampToast} />
        </div>
      )}

      {/* 하단 액션 바 */}
      <div style={{ flex: 'none', padding: '4px 20px calc(16px + env(safe-area-inset-bottom))', display: 'flex', gap: 12 }}>
        <button
          type="button"
          className={stage === 'idle' ? 'btn btn-blue' : 'btn'}
          style={stage === 'idle'
            ? { flex: 1, height: 54, fontSize: 16, textDecoration: 'none' }
            : { flex: 1, height: 54, fontSize: 15, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-ink-3)' }}
          onClick={() => setStage(stage === 'idle' ? 'first' : 'idle')}
        >
          {stage === 'idle' ? '코스 안내 시작' : '안내 종료'}
        </button>
        <button onClick={onRespin} aria-label="다시 돌리기" className="btn" style={{ width: 54, height: 54, borderRadius: 18, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M3 12 a9 9 0 1 1 3 6.7" />
            <path d="M3 20 v-4 h4" />
          </svg>
        </button>
      </div>

    </ScreenFrame>
  )
}
