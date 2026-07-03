import locateImg from '../assets/poses/locate.png'
import { ScreenFrame, Stars } from '../components/ScreenFrame'
import { DEPARTURES, type Departure } from '../mock/pois'

interface Props {
  selected: Departure
  onSelect: (departure: Departure) => void
  onBack: () => void
}

export function DepartureScreen({ selected, onSelect, onBack }: Props) {
  return (
    <ScreenFrame>
      <Stars />
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 0', zIndex: 2 }}>
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="btn btn-ghost"
          style={{ width: 44, height: 44, borderRadius: '50%', padding: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>어디서 출발하세요?</span>
      </header>

      <div className="fade-up" style={{ flex: 1, padding: '26px 24px 0', zIndex: 2 }}>
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, fontWeight: 600, color: 'var(--ink-2)', maxWidth: 250 }}>
            여행 모드에서는 출발점을 기준으로
            <br />
            방향을 계산해요. 탭 한 번이면 끝.
          </p>
          <img src={locateImg} alt="" style={{ position: 'absolute', right: -6, top: -18, width: 86, filter: 'drop-shadow(0 10px 16px rgba(0,10,40,.5))', animation: 'bobsm 3.2s ease-in-out infinite' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DEPARTURES.map((d) => {
            const on = d.id === selected.id
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '18px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: on ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: on ? 'rgba(255,122,69,.1)' : 'var(--glass)',
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 14, flex: 'none', display: 'grid', placeItems: 'center', background: on ? 'var(--accent)' : 'var(--glass-2)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={on ? '#fff' : 'var(--ink-2)'} strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z" />
                    <circle cx="12" cy="9" r="2.4" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{d.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{d.desc}</div>
                </div>
                {on && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
                    <path d="M5 12 l5 5 9-10" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 16, border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M9 12 l2 2 4-5" />
          </svg>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>지도에서 직접 고르기는 곧 열려요</span>
        </div>
      </div>
    </ScreenFrame>
  )
}
