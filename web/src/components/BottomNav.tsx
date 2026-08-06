import { useEffect, useRef, type ReactNode } from 'react'
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
  const navRef = useRef<HTMLElement | null>(null)

  // 내비게이션이 실제로 가리는 높이를 CSS 변수로 알린다. 각 화면이 하단 여백을
  // 숫자로 추정하지 않고 이 값을 쓰면 콘텐츠가 내비게이션에 잘리지 않는다.
  useEffect(() => {
    const node = navRef.current
    if (!node) return
    const publish = () => {
      document.documentElement.style.setProperty('--nav-h', `${Math.round(node.getBoundingClientRect().height)}px`)
    }
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      ref={navRef}
      className="bottom-nav"
      aria-label="주요 메뉴"
      style={{
        // 화면 컨테이너(.screen)의 계산 높이에 기대지 않도록 내비게이션은 뷰포트
        // 기준으로 고정하고, 480px 중앙 정렬과 safe area는 자체 스타일로 처리한다.
        // (실제 프레임 고정은 mobile-pwa.css의 #root position:fixed가 담당한다)
        // iOS standalone이 뷰포트를 상태바 높이만큼 짧게 보고하면 bottom: 0이 화면
        // 바닥보다 위에 멈추므로, 실측한 --app-bottom-gap만큼 다시 내린다.
        position: 'fixed',
        bottom: 'calc(var(--app-bottom-gap, 0px) * -1)',
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
