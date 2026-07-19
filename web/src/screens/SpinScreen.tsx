import { useCallback, useRef, useState } from 'react'
import { CompassRose, type CompassRoseHandle } from '../components/CompassRose'
import { ScreenFrame } from '../components/ScreenFrame'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { DialSlider } from '../components/DialSlider'
import { DIRECTIONS, directionFromHeading, type Departure } from '../mock/pois'

interface Props {
  departure: Departure
  /** 이동시간 예산(분) — Infinity = 하루 */
  dial: number
  onDialChange: (minutes: number) => void
  onOpenDeparture: () => void
  onSpun: (headingDeg: number) => void
  onNavigate: (tab: NavTab) => void
}

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
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4, color: 'var(--l-ink)' }}>스핀</span>
        <button
          onClick={onOpenDeparture}
          style={{ cursor: 'pointer', minHeight: 44, border: 'none', background: 'transparent', padding: '8px 0 8px 12px', color: 'var(--l-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', flex: 'none' }} />
          {departure.name} 기준
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
            <path d="M7 10 l5 5 5-5" />
          </svg>
        </button>
      </header>

      <div style={{ textAlign: 'center', padding: '18px 24px 0', zIndex: 2, minHeight: 84 }}>
        {busy ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--l-ink-3)' }}>{settled ? '오늘의 방향은' : '방향을 찾는 중…'}</div>
            <div style={{ marginTop: 4, fontSize: 34, fontWeight: 900, letterSpacing: -0.5, color: settled ? liveDir.color : 'var(--l-ink)', transition: 'color .3s ease' }}>
              {liveDir.label}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--l-ink)' }}>오늘, 어느 쪽으로 갈까요?</h1>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>원판을 휙 돌리고, 방향에 맡겨보세요</p>
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
          <div className={`spin-compass-hub${spinning ? ' is-spinning' : ''}`} aria-hidden>
            <svg viewBox="0 0 100 100">
              <defs>
                <linearGradient id="hubNeedleNorth" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#49b8ff" />
                  <stop offset="1" stopColor="#1e4fd8" />
                </linearGradient>
                <linearGradient id="hubNeedleSouth" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#dbe8ff" />
                  <stop offset="1" stopColor="#9eb8eb" />
                </linearGradient>
              </defs>
              <path d="M50 13 L64 52 L50 47 L36 52 Z" fill="url(#hubNeedleNorth)" />
              <path d="M50 87 L36 48 L50 53 L64 48 Z" fill="url(#hubNeedleSouth)" />
              <circle cx="50" cy="50" r="13" fill="#fff" stroke="#2f5cff" strokeWidth="3" />
              <path d="M50 41 L52.6 47.4 L59.5 48 L54.2 52.4 L55.8 59 L50 55.4 L44.2 59 L45.8 52.4 L40.5 48 L47.4 47.4 Z" fill="#2f5cff" />
            </svg>
          </div>
        </div>
      </div>

      {/* 하단 컨트롤 — 내브 높이만큼 여백 (스핀 중에는 페이드아웃) */}
      <div style={{ position: 'relative', minHeight: 150, padding: '0 24px calc(104px + env(safe-area-inset-bottom))', zIndex: 2 }}>
        <div style={{ opacity: busy ? 0 : 1, pointerEvents: busy ? 'none' : 'auto', transition: 'opacity .25s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DialSlider minutes={dial} onChange={onDialChange} />
          <button className="btn btn-blue" style={{ height: 58, fontSize: 17 }} onClick={() => rose.current?.spin()}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <path d="M4 12 a8 8 0 1 1 2.6 5.9" />
              <path d="M4 19 v-4 h4" />
            </svg>
            돌리기
          </button>
        </div>
      </div>

      <BottomNav active="spin" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
