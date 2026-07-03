import pointingImg from '../assets/poses/pointing.png'
import { BottomNav } from '../components/BottomNav'
import { IconStamp } from '../components/icons'
import { ScreenFrame } from '../components/ScreenFrame'
import { todaySpinCards } from '../mock/pois'
import type { Screen } from '../App'

const quickMenu = [
  {
    label: '명소',
    bg: '#e8f0ff',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" strokeWidth={2} strokeLinecap="round">
        <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z" />
        <circle cx="12" cy="9" r="2.4" />
      </svg>
    ),
  },
  {
    label: '축제',
    bg: '#e8f0ff',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" strokeWidth={2} strokeLinecap="round">
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 9 h18 M8 3 v4 M16 3 v4" />
      </svg>
    ),
  },
  {
    label: '도장깨기',
    bg: '#e8f0ff',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12 l3 3 5-6" />
      </svg>
    ),
    onClick: 'stamp' as Screen,
  },
  {
    label: '여행모드',
    bg: '#fff2ec',
    icon: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#e0603f" strokeWidth={2} strokeLinecap="round">
        <path d="M4 20 L20 20 M6 20 L6 10 L18 10 L18 20 M9 10 L12 4 L15 10" />
      </svg>
    ),
  },
]

export function HomeScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <ScreenFrame background="#f4f8ff">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 20, background: '#f4f8ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="26" height="26" viewBox="0 0 40 40">
            <path d="M20 4 L24 16 L36 20 L24 24 L20 36 L16 24 L4 20 L16 16 Z" fill="#1e4fd8" />
          </svg>
          <span style={{ font: `800 20px 'Baloo 2'`, color: '#17347f', letterSpacing: -0.5 }}>Spindle</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17347f" strokeWidth={2.2} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20 l-3.5-3.5" />
          </svg>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#8fbaff,#3b7bf5)', display: 'grid', placeItems: 'center', color: '#fff', font: `800 13px 'Baloo 2'` }}>B</div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 80, overflowY: 'auto' }}>
        <div style={{ margin: '8px 16px 0', height: 178, borderRadius: 26, background: 'linear-gradient(135deg,#4f8bff,#1e4fd8)', position: 'relative', overflow: 'hidden', padding: '20px 22px' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
          <div style={{ position: 'absolute', bottom: -40, right: 60, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 214 }}>
            <div style={{ font: `700 13px 'Noto Sans KR'`, color: '#cfe0ff' }}>붐비는 해변 말고,</div>
            <div style={{ font: `900 21px/1.32 'Noto Sans KR'`, color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>
              숨은 부산을
              <br />
              발견하세요
            </div>
            <button
              onClick={() => onNavigate('spin')}
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', borderRadius: 16, background: '#fff', color: '#1e4fd8', font: `800 14px 'Noto Sans KR'`, cursor: 'pointer', boxShadow: '0 8px 18px -6px rgba(0,0,0,.3)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e4fd8" strokeWidth={2.2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9 L10 14 L13 11 Z" fill="#1e4fd8" />
              </svg>
              지금 스핀하기
            </button>
          </div>
          <img src={pointingImg} style={{ position: 'absolute', right: -6, bottom: -4, width: 146, zIndex: 1, filter: 'drop-shadow(0 10px 14px rgba(0,10,40,.35))', transform: 'scaleX(-1)', animation: 'bobsm 3.4s ease-in-out infinite' }} alt="" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '18px 12px 4px' }}>
          {quickMenu.map((item) => (
            <button
              key={item.label}
              onClick={() => item.onClick && onNavigate(item.onClick)}
              style={{ background: 'none', border: 'none', cursor: item.onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: 0 }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 18, background: item.bg, display: 'grid', placeItems: 'center' }}>{item.icon}</div>
              <span style={{ font: `700 12px 'Noto Sans KR'`, color: '#3a4c78' }}>{item.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigate('stamp')}
          style={{ margin: '14px 16px 0', padding: '14px 16px', background: '#fff', border: 'none', borderRadius: 20, boxShadow: '0 10px 24px -14px rgba(20,40,90,.3)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', width: 'calc(100% - 32px)', textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ font: `800 14px 'Noto Sans KR'`, color: '#17347f' }}>원도심 도장깨기</div>
              <span style={{ font: `800 13px 'Baloo 2'`, color: '#2f5cff' }}>
                3<span style={{ color: '#c3d3ee' }}>/8</span>
              </span>
            </div>
            <div style={{ marginTop: 9, display: 'flex', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#5b93ff,#1e4fd8)', display: 'grid', placeItems: 'center' }}>
                  <IconStamp color="#fff" size={13} />
                </div>
              ))}
              {[0, 1].map((i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed #c3d3ee' }} />
              ))}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round">
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
          <div style={{ font: `900 18px 'Noto Sans KR'`, color: '#17347f' }}>오늘의 스핀 추천</div>
          <span style={{ font: `700 12px 'Noto Sans KR'`, color: '#8ba3cf' }}>더보기 ›</span>
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '0 20px', overflowX: 'auto' }}>
          {todaySpinCards.map((card) => (
            <div key={card.id} style={{ flex: 'none', width: 196 }}>
              <div style={{ height: 126, borderRadius: 20, background: card.gradient, position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    background: 'rgba(255,255,255,.94)',
                    borderRadius: 12,
                    font: `800 10.5px 'Noto Sans KR'`,
                    color: card.crowd === 'quiet' ? '#1fa971' : '#e0a021',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: card.crowd === 'quiet' ? '#1fa971' : '#e0a021' }} />
                  {card.crowd === 'quiet' ? '한적' : '보통'}
                </div>
                <div style={{ position: 'absolute', top: 10, right: 10, padding: '5px 10px', background: card.crowd === 'quiet' ? '#e0603f' : '#2f5cff', borderRadius: 12, font: `800 10.5px 'Noto Sans KR'`, color: '#fff' }}>{card.badge}</div>
              </div>
              <div style={{ padding: '10px 2px 0' }}>
                <div style={{ font: `800 15px 'Noto Sans KR'`, color: '#17347f' }}>{card.name}</div>
                <div style={{ marginTop: 3, font: `600 12px 'Noto Sans KR'`, color: '#8ba3cf' }}>
                  {card.category} · {card.district}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
