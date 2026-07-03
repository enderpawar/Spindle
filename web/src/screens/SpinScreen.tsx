import { useCallback, useRef, useState } from 'react'
import spinningImg from '../assets/poses/별이_spin.png'
import { CompassRose, type CompassRoseHandle } from '../components/CompassRose'
import { ScreenFrame, Stars } from '../components/ScreenFrame'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { DIALS, DIRECTIONS, directionFromHeading, type Departure, type DialId } from '../mock/pois'

interface Props {
  departure: Departure
  dial: DialId
  onDialChange: (dial: DialId) => void
  onOpenDeparture: () => void
  onSpun: (headingDeg: number) => void
  onNavigate: (tab: NavTab) => void
}

const reelItems = [...DIRECTIONS, ...DIRECTIONS, ...DIRECTIONS].map((d) => d.label)

/** 스핀 탭 — 밤바다 몰입 화면. 원판 드래그 또는 돌리기 버튼으로 방위를 정한다 */
export function SpinScreen({ departure, dial, onDialChange, onOpenDeparture, onSpun, onNavigate }: Props) {
  const rose = useRef<CompassRoseHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [settled, setSettled] = useState(false)
  const [dirIndex, setDirIndex] = useState(0)
  const liveDir = DIRECTIONS[dirIndex]

  // 방위 라벨이 바뀔 때만 리렌더 (매 프레임 setState 방지)
  const lastIndex = useRef(0)
  const handleHeading = useCallback((heading: number) => {
    const idx = DIRECTIONS.indexOf(directionFromHeading(heading))
    if (idx !== lastIndex.current) {
      lastIndex.current = idx
      setDirIndex(idx)
    }
  }, [])

  const handleSettle = useCallback(
    (heading: number) => {
      setSettled(true)
      setTimeout(() => onSpun(heading), 700) // 정지 방위를 잠깐 보여주고 연출 화면으로
    },
    [onSpun],
  )

  const busy = spinning || settled

  return (
    <ScreenFrame>
      <Stars />

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>스핀</span>
        <button onClick={onOpenDeparture} className="chip" style={{ cursor: 'pointer', minHeight: 44 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />
          여행 모드 · {departure.name}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
            <path d="M7 10 l5 5 5-5" />
          </svg>
        </button>
      </header>

      <div style={{ textAlign: 'center', padding: '18px 24px 0', zIndex: 2, minHeight: 84 }}>
        {busy ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{settled ? '오늘의 방향은' : '방향을 찾는 중…'}</div>
            <div style={{ marginTop: 4, fontSize: 34, fontWeight: 900, letterSpacing: -0.5, color: settled ? liveDir.color : 'var(--ink)', transition: 'color .3s ease' }}>
              {liveDir.label}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>오늘, 어느 쪽으로 갈까요?</h1>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-3)' }}>원판을 휙 돌리고, 방향에 맡겨보세요</p>
          </>
        )}
      </div>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '8px 0', zIndex: 1 }}>
        <div style={{ position: 'relative', width: 'min(72vw, 300px)' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-14%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${settled ? liveDir.color : 'rgba(91,147,255,.9)'} 0%, transparent 62%)`,
              opacity: settled ? 0.34 : 0.14,
              transition: 'opacity .4s ease',
              pointerEvents: 'none',
            }}
          />
          <CompassRose ref={rose} disabled={settled} onSpinningChange={setSpinning} onHeading={handleHeading} onSettle={handleSettle} />
          <img
            src={spinningImg}
            alt=""
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '31%',
              transform: 'translate(-50%, -54%)',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 10px 16px rgba(0,10,40,.5))',
              animation: spinning ? 'wobble 0.5s ease-in-out infinite' : 'bobsm 3.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* 하단 컨트롤 ↔ 스핀 릴 (크로스페이드) — 내브 높이만큼 여백 */}
      <div style={{ position: 'relative', minHeight: 150, padding: '0 24px calc(104px + env(safe-area-inset-bottom))', zIndex: 2 }}>
        <div style={{ opacity: busy ? 0 : 1, pointerEvents: busy ? 'none' : 'auto', transition: 'opacity .25s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="seg" role="radiogroup" aria-label="이동시간">
            {DIALS.map((d) => (
              <button key={d.id} className={d.id === dial ? 'on' : ''} onClick={() => onDialChange(d.id)} role="radio" aria-checked={d.id === dial}>
                <span className="seg-label">{d.label}</span>
                <span className="seg-desc">{d.desc}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => rose.current?.spin()}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <path d="M4 12 a8 8 0 1 1 2.6 5.9" />
              <path d="M4 19 v-4 h4" />
            </svg>
            돌리기
          </button>
        </div>

        <div aria-hidden style={{ position: 'absolute', inset: '0 0 auto', top: 30, opacity: busy ? 1 : 0, transition: 'opacity .25s ease', pointerEvents: 'none' }}>
          <div style={{ overflow: 'hidden', height: 56, WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)' }}>
            <div style={{ display: 'flex', gap: 12, width: 'max-content', animation: 'reelL 1.1s linear infinite' }}>
              {reelItems.map((label, i) => (
                <span
                  key={i}
                  style={{
                    flex: 'none',
                    padding: '14px 24px',
                    background: settled && label === liveDir.label ? liveDir.color : 'var(--glass-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    fontSize: 17,
                    fontWeight: 800,
                    color: settled && label === liveDir.label ? '#0f2540' : 'var(--ink-3)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="spin" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
