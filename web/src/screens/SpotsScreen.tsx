import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { MapView } from '../map/MapView'
import { DIRECTIONS, POI_POOL, type Departure, type Poi } from '../mock/pois'

const FILTERS = ['전체', '중구', '동구', '서구', '영도구']

interface Props {
  departure: Departure
  onNavigate: (tab: NavTab) => void
  onSelect: (poi: Poi) => void
}

/** 명소 탭 — 지도(기본)·리스트로 원도심·영도 POI 둘러보기 (Phase 2에서 areaBasedList2 연동) */
export function SpotsScreen({ departure, onNavigate, onSelect }: Props) {
  const [mode, setMode] = useState<'map' | 'list'>('map')
  const [filter, setFilter] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const list = useMemo(() => {
    const pool = filter === '전체' ? POI_POOL : POI_POOL.filter((p) => p.district === filter)
    return [...pool].sort((a, b) => a.walkMinutes - b.walkMinutes)
  }, [filter])

  // 필터가 바뀌어 선택 핀이 목록에서 빠지면 선택 해제
  useEffect(() => {
    if (selectedId && !list.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [list, selectedId])

  // ── 카드 스트립 ↔ 핀 양방향 동기화 ──
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const programmatic = useRef(false)

  const pick = (id: string | null) => {
    setSelectedId(id)
    if (!id) return
    const el = cardRefs.current.get(id)
    const strip = stripRef.current
    if (el && strip) {
      programmatic.current = true
      strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
      window.setTimeout(() => (programmatic.current = false), 450)
    }
  }

  const onStripScroll = () => {
    if (programmatic.current) return
    const strip = stripRef.current
    if (!strip) return
    const center = strip.scrollLeft + strip.clientWidth / 2
    let best: string | null = null
    let bestDist = Infinity
    cardRefs.current.forEach((el, id) => {
      const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - center)
      if (d < bestDist) {
        bestDist = d
        best = id
      }
    })
    if (best && best !== selectedId) setSelectedId(best)
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 5 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--l-ink)' }}>명소 둘러보기</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)' }}>원도심과 영도, {POI_POOL.length}곳의 이야기</div>
        </div>
        <div style={{ display: 'flex', padding: 3, gap: 2, borderRadius: 14, background: '#fff', boxShadow: '0 6px 14px -8px rgba(20,40,90,.25)' }}>
          {(
            [
              ['map', '지도'],
              ['list', '리스트'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                borderRadius: 11,
                fontSize: 12.5,
                fontWeight: 800,
                background: mode === m ? 'var(--l-primary)' : 'transparent',
                color: mode === m ? '#fff' : '#7089b8',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, padding: '14px 20px 10px', overflowX: 'auto', zIndex: 5 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`l-zone-chip ${f === filter ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {mode === 'map' ? (
        <div style={{ position: 'relative', flex: 1, borderRadius: '22px 22px 0 0', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)' }}>
          <MapView pois={list} departure={departure} selectedId={selectedId} onPick={pick} onOpen={onSelect} />

          {/* 하단 카드 스트립 — 스와이프하면 지도가 따라간다 */}
          <div
            ref={stripRef}
            onScroll={onStripScroll}
            className="no-scrollbar"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 'calc(96px + env(safe-area-inset-bottom))',
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              padding: '8px 40px 14px',
            }}
          >
            {list.map((poi) => {
              const dir = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
              const sel = poi.id === selectedId
              return (
                <div
                  key={poi.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(poi.id, el)
                    else cardRefs.current.delete(poi.id)
                  }}
                  style={{
                    flex: 'none',
                    width: 'calc(100% - 80px)',
                    scrollSnapAlign: 'center',
                    background: '#fff',
                    borderRadius: 20,
                    padding: '14px 16px',
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
                  <div style={{ marginTop: 7, fontSize: 12.5, lineHeight: 1.55, fontWeight: 600, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {poi.story}
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={() => onSelect(poi)}
                    style={{ marginTop: 11, width: '100%', minHeight: 42, borderRadius: 13, fontSize: 13.5 }}
                  >
                    자세히 보기
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '6px 20px calc(110px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((poi) => {
            const dir = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
            return (
              <button
                key={poi.id}
                onClick={() => onSelect(poi)}
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
                  <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, fontWeight: 500, color: 'var(--l-ink-2)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{poi.story}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                  <path d="M9 6 l6 6 l-6 6" />
                </svg>
              </button>
            )
          })}
        </div>
      )}

      <BottomNav active="spots" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
