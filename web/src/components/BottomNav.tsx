import type { ReactNode } from 'react'
import {
  NavHomeIcon,
  NavSettingsIcon,
  NavSpotsIcon,
  NavStampIcon,
} from './Icons'

export type NavTab = 'home' | 'spots' | 'spin' | 'stamp' | 'settings'

const ACTIVE = '#1e4fd8'
const INACTIVE = '#9db3d8'

function Item({ label, active, icon, onClick }: { label: string; active: boolean; icon: ReactNode; onClick: () => void }) {
  const tone = active ? ACTIVE : INACTIVE
  return (
    <button
      className={`nav-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 8px', minWidth: 44 }}
    >
      <span className="nav-icon" key={active ? 'active' : 'idle'} style={{ color: tone, display: 'inline-flex' }}>{icon}</span>
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
        padding: '12px 12px max(10px, env(safe-area-inset-bottom))',
        zIndex: 20,
      }}
    >
      <Item
        label="홈"
        active={active === 'home'}
        onClick={() => onNavigate('home')}
        icon={
          <NavHomeIcon />
        }
      />
      <Item
        label="명소"
        active={active === 'spots'}
        onClick={() => onNavigate('spots')}
        icon={
          <NavSpotsIcon />
        }
      />
      <div className="nav-spin-slot">
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
            background: '#fff',
            boxShadow: '0 6px 16px -6px rgba(20,50,140,.45), inset 0 0 0 1px #dbe6fa',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <img src="/brand-mark-192.png" alt="" width={36} height={36} />
        </button>
        <span style={{ fontSize: 11, fontWeight: 800, color: c('spin') }}>스핀</span>
      </div>
      <Item
        label="도장"
        active={active === 'stamp'}
        onClick={() => onNavigate('stamp')}
        icon={
          <NavStampIcon />
        }
      />
      <Item
        label="설정"
        active={active === 'settings'}
        onClick={() => onNavigate('settings')}
        icon={
          <NavSettingsIcon />
        }
      />
    </nav>
  )
}
