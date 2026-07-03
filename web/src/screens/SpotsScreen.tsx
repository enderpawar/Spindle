import { useState } from 'react'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { ScreenFrame } from '../components/ScreenFrame'
import { DIRECTIONS, POI_POOL, type Poi } from '../mock/pois'

const FILTERS = ['전체', '중구', '동구', '서구', '영도구']

/** 명소 탭 — 원도심·영도 POI 둘러보기 (Phase 2에서 areaBasedList2 연동) */
export function SpotsScreen({ onNavigate, onSelect }: { onNavigate: (tab: NavTab) => void; onSelect: (poi: Poi) => void }) {
  const [filter, setFilter] = useState('전체')
  const list = filter === '전체' ? POI_POOL : POI_POOL.filter((p) => p.district === filter)

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ padding: '18px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--l-ink)' }}>명소 둘러보기</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)' }}>원도심과 영도, {POI_POOL.length}곳의 이야기</div>
      </header>

      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, padding: '14px 20px 0', overflowX: 'auto' }}>
        {FILTERS.map((f) => (
          <button key={f} className={`l-zone-chip ${f === filter ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px calc(110px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((poi) => {
          const dir = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
          return (
            <button
              key={poi.id}
              onClick={() => onSelect(poi)}
              style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, background: '#fff', border: 'none', borderRadius: 20, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 76, height: 76, borderRadius: 16, flex: 'none', background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 140%)`, display: 'grid', placeItems: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.6} aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.7)" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--l-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</span>
                  {poi.tier === 3 && <span style={{ flex: 'none', padding: '3px 7px', borderRadius: 8, background: '#fff2ec', color: 'var(--l-orange)', fontSize: 10, fontWeight: 800 }}>숨은 명소</span>}
                </div>
                <div style={{ marginTop: 3, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                  {poi.category} · {poi.district} · {dir.label}쪽 도보 {poi.walkMinutes}분
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                <path d="M9 6 l6 6 l-6 6" />
              </svg>
            </button>
          )
        })}
      </div>

      <BottomNav active="spots" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
