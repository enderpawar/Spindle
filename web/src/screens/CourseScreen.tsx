import { useEffect, useRef, useState } from 'react'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { StampNotice } from '../components/StampNotice'
import { KakaoIcon, NaverIcon } from '../components/BrandIcon'
import { MapView } from '../map/MapView'
import { markVisited, useVisited } from '../lib/visited'
import type { Departure } from '../mock/pois'
import type { CourseStopView, ReadyCourse } from '../engine/spinCourse'

interface Props {
  course: ReadyCourse
  /** 지도 출발 마커·첫 구간 라벨용 출발점 */
  departure: Departure
  onBack: () => void
  onRespin: () => void
}

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
  const [navStop, setNavStop] = useState<CourseStopView | null>(null)
  const [stampToast, setStampToast] = useState<string | null>(null)
  const visited = useVisited()

  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const courseOrder = stops.map((s) => s.poi.id)
  const stopPois = stops.map((s) => s.poi)

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
  const openNav = (stop: CourseStopView) => {
    setNavStop(stop)
    setStampToast(null)
    if (markVisited(stop.poi.id)) {
      setStampToast(stop.poi.district)
    }
  }

  const legLabel = (stop: CourseStopView) =>
    stop.order === 1
      ? `${departure.name}에서 ${METHOD_LABEL[stop.method]} 약 ${stop.legMinutes}분`
      : `직전 장소에서 ${METHOD_LABEL[stop.method]} 약 ${stop.legMinutes}분`

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
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--l-ink-3)' }}>총 약 {totalMinutes}분</span>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openNav(stop)
                  }}
                  className="btn"
                  style={{ marginTop: 11, height: 42, width: '100%', background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-primary)', fontSize: 13.5 }}
                >
                  이 장소 길찾기
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 하단 액션 바 */}
      <div style={{ flex: 'none', padding: '4px 20px calc(16px + env(safe-area-inset-bottom))', display: 'flex', gap: 12 }}>
        <button className="btn btn-blue" style={{ flex: 1, height: 54, fontSize: 16 }} onClick={() => openNav(stops[0])}>
          첫 장소부터 출발
        </button>
        <button onClick={onRespin} aria-label="다시 돌리기" className="btn" style={{ width: 54, height: 54, borderRadius: 18, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M3 12 a9 9 0 1 1 3 6.7" />
            <path d="M3 20 v-4 h4" />
          </svg>
        </button>
      </div>

      {/* 길찾기 앱 선택 시트 */}
      {navStop && (
        <div className="motion-overlay" style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <button aria-label="닫기" onClick={() => { setNavStop(null); setStampToast(null) }} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(12,26,54,.45)', cursor: 'pointer' }} />
          <div className="motion-sheet" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 20px calc(26px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(20,40,90,.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--l-ink-3)' }}>{navStop.order}번째 · {navStop.poi.district}</div>
            <div style={{ marginTop: 2, marginBottom: stampToast ? 10 : 14, fontSize: 17, fontWeight: 900, color: 'var(--l-ink)' }}>{navStop.poi.name}</div>
            {stampToast && <StampNotice district={stampToast} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <NavLink href={`https://map.kakao.com/link/search/${encodeURIComponent(`부산 ${navStop.poi.name}`)}`} label="카카오맵" brand="kakao" />
              <NavLink href={`https://map.naver.com/p/search/${encodeURIComponent(`부산 ${navStop.poi.name}`)}`} label="네이버지도" brand="naver" />
            </div>
          </div>
        </div>
      )}

    </ScreenFrame>
  )
}

function NavLink({ href, label, brand }: { href: string; label: string; brand: 'kakao' | 'naver' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn"
      style={{ height: 54, background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-ink)', fontSize: 15, textDecoration: 'none', justifyContent: 'flex-start', paddingLeft: 16, gap: 12 }}
    >
      <span style={{ display: 'grid', placeItems: 'center', flex: 'none' }}>{brand === 'kakao' ? <KakaoIcon /> : <NaverIcon />}</span>
      {label}으로 길찾기
    </a>
  )
}
