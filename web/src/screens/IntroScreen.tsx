import { useEffect, useRef, useState } from 'react'

/**
 * 앱 콜드 스타트 인트로 스플래시 (약 3.2초).
 * 라이트 테마 배경에서 투명 배경의 브랜드 마크가 중앙에 페이드인되며 위로 떠오르고,
 * 이어 "Spindle" 워드마크가 아래에서 올라온다. 로딩이 끝나면 하단의 파란 물결이
 * 화면을 채우며 앱 홈(라이트)으로 자연스럽게 디졸브한다.
 * 화면 아무 곳이나 탭하면 즉시 건너뛴다. prefers-reduced-motion이면 짧은 페이드만.
 */

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const HOLD_MS = REDUCED ? 800 : 1950
const SURGE_MS = REDUCED ? 0 : 760
const EXIT_MS = REDUCED ? 220 : 480

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [surging, setSurging] = useState(false)
  const [exiting, setExiting] = useState(false)
  const doneRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useEffect(() => {
    timersRef.current.push(window.setTimeout(() => setSurging(true), HOLD_MS))
    timersRef.current.push(window.setTimeout(() => setExiting(true), HOLD_MS + SURGE_MS))
    timersRef.current.push(window.setTimeout(finish, HOLD_MS + SURGE_MS + EXIT_MS))
    return () => timersRef.current.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 탭 시 물결이 짧게 차오른 뒤 퇴장한다. 이미 예약된 자동 완료 타이머는 취소한다.
  const skip = () => {
    if (doneRef.current || exiting) return
    timersRef.current.forEach(window.clearTimeout)
    setSurging(true)
    setExiting(true)
    timersRef.current = [window.setTimeout(finish, REDUCED ? EXIT_MS : 360)]
  }

  return (
    <div
      className={`intro${surging ? ' intro--surging' : ''}${exiting ? ' intro--exit' : ''}`}
      role="status"
      aria-label="Spindle 시작하는 중"
      onClick={skip}
    >
      <div className="intro-hero">
        <img className="intro-appicon" src="/brand-mark-192.png" alt="" draggable={false} />
        <span className="intro-logo">Spindle</span>
      </div>

      <div className="intro-tide" aria-hidden="true">
        <span className="intro-tide-depth" />
        <svg className="intro-tide-surface intro-tide-surface--back" viewBox="0 0 1440 220" preserveAspectRatio="none">
          <path d="M0 108C116 28 242 22 360 88C482 156 590 148 714 76C832 8 966 24 1082 96C1196 166 1322 148 1440 70V220H0Z" />
        </svg>
        <svg className="intro-tide-surface intro-tide-surface--front" viewBox="0 0 1440 220" preserveAspectRatio="none">
          <path d="M0 126C102 74 206 52 318 90C436 130 526 164 648 122C772 80 872 52 998 100C1122 148 1280 146 1440 92V220H0Z" />
        </svg>
      </div>
    </div>
  )
}
