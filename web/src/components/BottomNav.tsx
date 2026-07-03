import { IconCheckCircle, IconHome, IconShare, IconSpin, IconSpot } from './icons'

export type NavTab = 'home' | 'spots' | 'spin' | 'stamp' | 'share'

const ACTIVE = '#1e4fd8'
const INACTIVE = '#9db3d8'

function Item({ label, active, icon, onClick }: { label: string; active: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 0,
      }}
    >
      {icon}
      <span style={{ font: `${active ? 800 : 700} 11px 'Noto Sans KR'`, color: active ? ACTIVE : INACTIVE }}>{label}</span>
    </button>
  )
}

export function BottomNav({ active, onNavigate }: { active: NavTab; onNavigate: (tab: NavTab) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        background: '#fff',
        boxShadow: '0 -6px 20px -8px rgba(20,40,90,.18)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '12px 16px 0',
        zIndex: 20,
      }}
    >
      <Item label="홈" active={active === 'home'} onClick={() => onNavigate('home')} icon={<IconHome color={active === 'home' ? ACTIVE : INACTIVE} />} />
      <Item label="명소" active={active === 'spots'} onClick={() => onNavigate('spots')} icon={<IconSpot color={active === 'spots' ? ACTIVE : INACTIVE} />} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', top: -16 }}>
        <button
          onClick={() => onNavigate('spin')}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: 'radial-gradient(circle at 38% 32%,#5b93ff,#1e4fd8 70%)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 10px 22px -6px rgba(30,79,216,.6)',
            animation: 'pulseL 2.8s ease-in-out infinite',
          }}
        >
          <IconSpin color="#fff" />
        </button>
        <span style={{ font: `800 11px 'Noto Sans KR'`, color: active === 'spin' ? ACTIVE : INACTIVE }}>스핀</span>
      </div>
      <Item label="도장" active={active === 'stamp'} onClick={() => onNavigate('stamp')} icon={<IconCheckCircle color={active === 'stamp' ? ACTIVE : INACTIVE} />} />
      <Item label="공유" active={active === 'share'} onClick={() => onNavigate('share')} icon={<IconShare color={active === 'share' ? ACTIVE : INACTIVE} />} />
    </div>
  )
}
