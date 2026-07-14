import type { ReactNode } from 'react'

export type NavTab = 'home' | 'spots' | 'spin' | 'stamp' | 'settings'

const ACTIVE = '#1e4fd8'
const INACTIVE = '#9db3d8'

function Item({ label, active, icon, onClick }: { label: string; active: boolean; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`nav-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 8px', minWidth: 44 }}
    >
      <span className="nav-icon" key={active ? 'active' : 'idle'}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: active ? 800 : 700, color: active ? ACTIVE : INACTIVE }}>{label}</span>
    </button>
  )
}

export function BottomNav({ active, onNavigate }: { active: NavTab; onNavigate: (tab: NavTab) => void }) {
  const c = (tab: NavTab) => (active === tab ? ACTIVE : INACTIVE)
  return (
    <nav
      className="bottom-nav"
      aria-label="주요 메뉴"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        boxShadow: '0 -6px 20px -8px rgba(20,40,90,.18)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '12px 12px calc(10px + env(safe-area-inset-bottom))',
        zIndex: 20,
      }}
    >
      <Item
        label="홈"
        active={active === 'home'}
        onClick={() => onNavigate('home')}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill={active === 'home' ? ACTIVE : 'none'} stroke={c('home')} strokeWidth={2} strokeLinejoin="round" aria-hidden>
            <path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" />
          </svg>
        }
      />
      <Item
        label="명소"
        active={active === 'spots'}
        onClick={() => onNavigate('spots')}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c('spots')} strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M12 21 C8.5 17.5 5 13.6 5 9.5 a7 7 0 0 1 14 0 c0 4.1-3.5 8-7 11.5 z" />
            <circle cx="12" cy="9.5" r="2.4" />
          </svg>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', top: -18 }}>
        <button
          onClick={() => onNavigate('spin')}
          aria-label="스핀"
          aria-current={active === 'spin' ? 'page' : undefined}
          className={`nav-fab${active === 'spin' ? ' is-active' : ''}`}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--l-primary)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9 L10 14 L13 11 Z" fill="#fff" />
          </svg>
        </button>
        <span style={{ fontSize: 11, fontWeight: 800, color: c('spin') }}>스핀</span>
      </div>
      <Item
        label="도장"
        active={active === 'stamp'}
        onClick={() => onNavigate('stamp')}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c('stamp')} strokeWidth={2} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12 l3 3 5-6" />
          </svg>
        }
      />
      <Item
        label="설정"
        active={active === 'settings'}
        onClick={() => onNavigate('settings')}
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c('settings')} strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3 v2.4 M12 18.6 V21 M3 12 h2.4 M18.6 12 H21 M5.6 5.6 l1.7 1.7 M16.7 16.7 l1.7 1.7 M18.4 5.6 l-1.7 1.7 M7.3 16.7 l-1.7 1.7" />
          </svg>
        }
      />
    </nav>
  )
}
