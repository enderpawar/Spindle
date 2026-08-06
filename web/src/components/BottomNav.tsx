import type { ReactNode } from 'react'
import {
  NavHomeIcon,
  NavSettingsIcon,
  NavSpotsIcon,
  NavStampIcon,
} from './Icons'

export type NavTab = 'home' | 'spots' | 'spin' | 'stamp' | 'settings'

const ACTIVE = '#1e4fd8'
// 흰 내비게이션 바에서 작은 라벨도 WCAG AA 대비를 확보한다.
const INACTIVE = '#5b7098'

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
        // iOS standalone은 화면 컨테이너 높이를 실제 표시 영역보다 짧게
        // 계산할 수 있다. 내비게이션은 컨테이너가 아니라 뷰포트 하단에
        // 고정하고 safe area는 내부 패딩으로 흡수한다.
        position: 'fixed',
        bottom: 0,
        left: '50%',
        width: '100%',
        maxWidth: 480,
        transform: 'translateX(-50%)',
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
            background: 'var(--l-primary)',
            boxShadow: '0 8px 18px -8px rgba(20,50,140,.55)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {/* 파란 배지 위에서 로고(파란 그라디언트)가 묻히지 않도록 흰 원을 깔고 얹는다 */}
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img src="/brand-mark-192.png" alt="" width={32} height={32} />
          </span>
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
