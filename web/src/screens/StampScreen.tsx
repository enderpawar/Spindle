import { useState } from 'react'
import locateImg from '../assets/poses/별이_explore.webp'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { ScreenFrame } from '../components/ScreenFrame'
import { useVisited } from '../lib/visited'
import { zones } from '../mock/stamps'

/** 도장깨기 · 존 수집 (디자인 3a-5) — 방문 기록(lib/visited.ts, 단말 저장)과 연결 */
export function StampScreen({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const visited = useVisited()
  const [activeZoneId, setActiveZoneId] = useState(zones[0].id)
  const zone = zones.find((z) => z.id === activeZoneId) ?? zones[0]
  const collected = zone.slots.filter((s) => visited.has(s.poi.id)).length

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      {/* 블루 헤더 패널 */}
      <div style={{ background: 'linear-gradient(160deg,#3b7bf5,#1e4fd8)', borderRadius: '0 0 36px 36px', padding: '26px 20px 20px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>원도심 도장깨기</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: '#cfe0ff' }}>부산의 동네를 하나씩 발견해 보세요</div>
        <img src={locateImg} alt="" className="stamp-header-mascot" style={{ position: 'absolute', right: 16, top: 12, width: 78, filter: 'drop-shadow(0 8px 14px rgba(0,10,40,.35))' }} />

        <div style={{ marginTop: 18, padding: 16, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            <span>{zone.label}</span>
            <span>
              {collected} / {zone.slots.length}
            </span>
          </div>
          <div style={{ marginTop: 10, height: 9, background: 'rgba(255,255,255,.25)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(collected / Math.max(zone.slots.length, 1)) * 100}%`, height: '100%', background: '#fff', borderRadius: 6, transition: 'width .35s ease' }} />
          </div>
        </div>
      </div>

      {/* 존 탭 */}
      <div className="no-scrollbar spots-category-tabs stamp-region-tabs" role="group" aria-label="도장 지역" style={{ display: 'flex', gap: 8, padding: '10px 20px 0', overflowX: 'auto', zIndex: 2 }}>
        {zones.map((z) => (
          <button key={z.id} className={z.id === activeZoneId ? 'is-active' : ''} aria-pressed={z.id === activeZoneId} onClick={() => setActiveZoneId(z.id)}>
            {z.label}
          </button>
        ))}
      </div>

      {/* 도장 그리드 */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px calc(110px + env(safe-area-inset-bottom))' }}>
        {collected === 0 && (
          <div className="stamp-first-visit">
            <strong>첫 발견을 도장으로 남겨보세요</strong>
            <p>어디부터 갈지 고민된다면 스핀으로 골라보세요.</p>
            <button type="button" onClick={() => onNavigate('spin')}>스핀으로 장소 찾기 <span aria-hidden>›</span></button>
          </div>
        )}
        <div key={zone.id} className="stamp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 }}>
          {zone.slots.map((slot) => {
            const isCollected = visited.has(slot.poi.id)
            return (
            <div key={slot.poi.id} className="stamp-slot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {isCollected ? (
                <img src="/stamp-mark-512.png" alt="획득한 참 잘했어요 도장" style={{ width: 82, height: 82, objectFit: 'contain' }} />
              ) : (
                <div className="stamp-unvisited" style={{ width: 82, height: 82, borderRadius: '50%', border: '2px dashed #c3d3ee', display: 'grid', placeItems: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2} aria-hidden>
                    <path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z" />
                    <circle cx="12" cy="9" r="2" />
                  </svg>
                </div>
              )}
              <span className="stamp-slot-name" style={{ fontSize: 11, fontWeight: 600, color: 'var(--l-ink-2)', textAlign: 'center' }}>
                {slot.shortName}
              </span>
              <span className={`stamp-slot-status ${isCollected ? 'is-collected' : ''}`}>{isCollected ? '방문 완료' : '방문 전'}</span>
            </div>
            )
          })}
        </div>
        <button className="btn btn-blue" style={{ marginTop: 20, width: '100%', height: 52, fontSize: 15 }} onClick={() => onNavigate('spin')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9 L10 14 L13 11 Z" fill="#fff" />
          </svg>
          다음 스핀으로 채우기
        </button>
      </div>

      <BottomNav active="stamp" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
