import locateImg from '../assets/poses/별이_curios.webp'
import { ScreenFrame } from '../components/ScreenFrame'
import { MAP_PICKED_ORIGIN_ID } from '../engine/origins'
import { DEPARTURES, type Departure } from '../mock/pois'

interface Props {
  selected: Departure
  onSelect: (departure: Departure) => void
  /** 지도에서 좌표를 직접 찍는 화면으로 이동 */
  onOpenMap: () => void
  onBack: () => void
}

export function DepartureScreen({ selected, onSelect, onOpenMap, onBack }: Props) {
  // 지도에서 찍은 출발점은 프리셋 아래 한 칸으로 남아 다시 고를 수 있다.
  const options = selected.id === MAP_PICKED_ORIGIN_ID ? [...DEPARTURES, selected] : DEPARTURES


  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 0', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--l-ink)' }}>어디서 출발하세요?</span>
      </header>

      <div className="fade-up" style={{ flex: 1, padding: '26px 24px 0', zIndex: 2 }}>
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, fontWeight: 600, color: 'var(--l-ink-2)', maxWidth: 250 }}>
            여행 모드에서는 출발점을 기준으로
            <br />
            방향을 계산해요. 탭 한 번이면 끝.
          </p>
          <img src={locateImg} alt="" style={{ position: 'absolute', right: -6, top: -18, width: 86, filter: 'drop-shadow(0 10px 18px rgba(20,40,90,.22))', animation: 'bobsm 3.2s ease-in-out infinite' }} />
        </div>

        <p style={{ margin: '-6px 0 18px', fontSize: 12.5, lineHeight: 1.6, fontWeight: 600, color: 'var(--l-ink-3)' }}>
          Spindle은 지금 원도심과 영도에 집중해요. 붐비는 곳 너머의 골목으로 안내하기 위한 선택이에요.
        </p>

        <div className="motion-card-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((d) => {
            const on = d.id === selected.id
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className="motion-card motion-card-enter"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '18px 18px',
                  borderRadius: 18,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: on ? '1.5px solid var(--l-primary)' : '1px solid var(--l-line)',
                  background: on ? 'var(--l-soft)' : '#fff',
                  boxShadow: on ? '0 10px 24px -16px rgba(30,79,216,.5)' : '0 8px 20px -16px rgba(20,40,90,.25)',
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 14, flex: 'none', display: 'grid', placeItems: 'center', background: on ? 'var(--l-primary)' : 'var(--l-soft)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={on ? '#fff' : 'var(--l-ink-3)'} strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z" />
                    <circle cx="12" cy="9" r="2.4" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--l-ink)' }}>{d.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>{d.desc}</div>
                </div>
                {on && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
                    <path d="M5 12 l5 5 9-10" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={onOpenMap}
          className="motion-card"
          style={{ marginTop: 16, width: '100%', padding: '14px 16px', borderRadius: 16, border: '1px dashed var(--l-line)', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--l-ink-2)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 3 L3 5.4 v15.2 L9 18.2 l6 2.4 6-2.4 V3 L15 5.4 Z" />
            <path d="M9 3 v15.2 M15 5.4 v15.2" />
          </svg>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>지도에서 좌표 직접 찍기</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink-3)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 5 l7 7 -7 7" />
          </svg>
        </button>
      </div>
    </ScreenFrame>
  )
}
