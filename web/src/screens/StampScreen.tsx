import { useState } from 'react'
import locateImg from '../assets/poses/별이_explore.png'
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
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>원도심 도장깨기</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: '#cfe0ff' }}>사라져가는 동네를 하나씩 채워보세요</div>
        <img src={locateImg} alt="" style={{ position: 'absolute', right: 16, top: 12, width: 78, filter: 'drop-shadow(0 8px 14px rgba(0,10,40,.35))', animation: 'bobsm 3.2s ease-in-out infinite' }} />

        <div style={{ marginTop: 18, padding: 16, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#fff' }}>
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
      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, padding: '16px 20px 0', overflowX: 'auto', zIndex: 2 }}>
        {zones.map((z) => (
          <button key={z.id} className={`l-zone-chip ${z.id === activeZoneId ? 'on' : ''}`} onClick={() => setActiveZoneId(z.id)}>
            {z.label}
          </button>
        ))}
      </div>

      {/* 도장 그리드 */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px calc(110px + env(safe-area-inset-bottom))' }}>
        {collected === 0 && (
          <div style={{ marginBottom: 16, padding: '13px 15px', background: 'var(--l-soft)', borderRadius: 14, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: 'var(--l-ink-2)', textAlign: 'center' }}>
            아직 도장이 없어요. 스핀을 돌려 이 동네를 방문하면 도장이 하나씩 채워져요.
          </div>
        )}
        <div key={zone.id} className="motion-card-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {zone.slots.map((slot) => {
            const isCollected = visited.has(slot.poi.id)
            return (
            <div key={slot.poi.id} className="motion-card-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {isCollected ? (
                <img src="/stamp-mark-512.png" alt="획득한 참 잘했어요 도장" style={{ width: 82, height: 82, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 82, height: 82, borderRadius: '50%', border: '2.5px dashed #c3d3ee', display: 'grid', placeItems: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2} aria-hidden>
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
                  </svg>
                </div>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: isCollected ? 'var(--l-ink-2)' : '#aebdd8', textAlign: 'center' }}>
                {isCollected ? slot.shortName : '???'}
              </span>
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
