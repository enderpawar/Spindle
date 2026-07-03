import { useState } from 'react'
import locateImg from '../assets/poses/locate.png'
import { BottomNav } from '../components/BottomNav'
import { IconStamp } from '../components/icons'
import { ScreenFrame } from '../components/ScreenFrame'
import { zones } from '../mock/stamps'
import type { Screen } from '../App'

export function StampScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [activeZoneId, setActiveZoneId] = useState(zones[0].id)
  const activeZone = zones.find((z) => z.id === activeZoneId) ?? zones[0]
  const remaining = Math.max(activeZone.total - activeZone.slots.length, 0)
  const slots = [...activeZone.slots, ...Array.from({ length: remaining }, () => ({ name: null }))]

  return (
    <ScreenFrame background="#f4f8ff">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, background: 'linear-gradient(160deg,#3b7bf5,#1e4fd8)', borderRadius: '0 0 36px 36px' }} />

      <div style={{ position: 'absolute', top: 24, left: 20, right: 20, zIndex: 10 }}>
        <div style={{ font: `900 24px 'Noto Sans KR'`, color: '#fff' }}>원도심 도장깨기</div>
        <div style={{ marginTop: 4, font: `600 13px 'Noto Sans KR'`, color: '#cfe0ff' }}>사라져가는 동네를 하나씩 채워보세요</div>
        <img src={locateImg} style={{ position: 'absolute', right: 0, top: -6, width: 78, filter: 'drop-shadow(0 8px 14px rgba(0,10,40,.35))', animation: 'bobsm 3.2s ease-in-out infinite' }} alt="" />

        <div style={{ marginTop: 18, padding: 16, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: `800 13px 'Noto Sans KR'`, color: '#fff' }}>
            <span>{activeZone.label}</span>
            <span>
              {activeZone.collected} / {activeZone.total}
            </span>
          </div>
          <div style={{ marginTop: 10, height: 9, background: 'rgba(255,255,255,.25)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(activeZone.collected / activeZone.total) * 100}%`, height: '100%', background: '#fff', borderRadius: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 250, left: 20, right: 20, display: 'flex', gap: 8, zIndex: 10, overflowX: 'auto' }}>
        {zones.map((zone) => {
          const active = zone.id === activeZoneId
          return (
            <button
              key={zone.id}
              onClick={() => setActiveZoneId(zone.id)}
              style={{
                flex: 'none',
                padding: '9px 16px',
                background: active ? '#2f5cff' : '#fff',
                border: active ? 'none' : '1.5px solid #dbe6fa',
                borderRadius: 16,
                font: `${active ? 800 : 700} 13px 'Noto Sans KR'`,
                color: active ? '#fff' : '#7089b8',
                cursor: 'pointer',
              }}
            >
              {zone.label}
            </button>
          )
        })}
      </div>

      <div style={{ position: 'absolute', top: 306, left: 20, right: 20, bottom: 80, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {slots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {slot.name ? (
                <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#5b93ff,#1e4fd8)', display: 'grid', placeItems: 'center', boxShadow: '0 10px 20px -10px rgba(30,79,216,.6)' }}>
                  <IconStamp color="#fff" size={34} />
                </div>
              ) : (
                <div style={{ width: 82, height: 82, borderRadius: '50%', border: '2.5px dashed #c3d3ee', display: 'grid', placeItems: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2}>
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
                  </svg>
                </div>
              )}
              <span style={{ font: `700 11px 'Noto Sans KR'`, color: slot.name ? '#3a4c78' : '#aebdd8' }}>{slot.name ?? '???'}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => onNavigate('spin')}
          style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 18, background: '#17347f', color: '#fff', font: `800 15px 'Noto Sans KR'`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2}>
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
