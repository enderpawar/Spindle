import { BottomNav, type NavTab } from '../components/BottomNav'
import { ScreenFrame } from '../components/ScreenFrame'
import { DIALS, type Departure, type DialId } from '../mock/pois'

interface Props {
  departure: Departure
  dial: DialId
  onDialChange: (dial: DialId) => void
  onOpenDeparture: () => void
  onReplayGuide: () => void
  onNavigate: (tab: NavTab) => void
}

export function SettingsScreen({ departure, dial, onDialChange, onOpenDeparture, onReplayGuide, onNavigate }: Props) {
  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ padding: '18px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--l-ink)' }}>설정</div>
      </header>

      <div className="no-scrollbar motion-card-list" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px calc(110px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 출발점 */}
        <button
          onClick={onOpenDeparture}
          className="motion-card motion-card-enter"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', background: '#fff', border: 'none', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--l-ink-3)' }}>여행 모드 출발점</div>
            <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800, color: 'var(--l-ink)' }}>{departure.name}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        {/* 이동시간 기본값 */}
        <div style={{ padding: '16px 16px', background: '#fff', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--l-ink-3)', marginBottom: 10 }}>이동시간 기본값</div>
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="이동시간 기본값">
            {DIALS.map((d) => {
              const on = d.id === dial
              return (
                <button
                  key={d.id}
                  onClick={() => onDialChange(d.id)}
                  className="motion-card"
                  role="radio"
                  aria-checked={on}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    border: on ? 'none' : '1.5px solid var(--l-line)',
                    borderRadius: 13,
                    background: on ? 'var(--l-primary)' : '#fff',
                    color: on ? '#fff' : '#7089b8',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{d.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{d.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 실제 홈 화면 위 코치마크 다시 보기 */}
        <button
          onClick={onReplayGuide}
          className="motion-card motion-card-enter"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', background: '#fff', border: 'none', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--l-ink)' }}>사용법 다시 보기</div>
            <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>실제 화면에서 기능 위치를 안내해요</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        {/* 신뢰 안내 */}
        <div style={{ padding: '16px 16px', background: 'var(--l-soft)', borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--l-ink-2)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2.2} aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
            </svg>
            위치와 방위는 휴대폰 안에서만 계산돼요. 서버로 보내지 않아요.
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>계정과 개인정보 수집 없이 쓰는 서비스예요 · 관광지 정보 출처: TourAPI 실시간 조회</div>
        </div>

        <div style={{ textAlign: 'center', padding: '12px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--l-ink-3)' }}>
          Spindle · 부산 원도심·영도를 돌려 발견하는 탐색
        </div>
      </div>

      <BottomNav active="settings" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
