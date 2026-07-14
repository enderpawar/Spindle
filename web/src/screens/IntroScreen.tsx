import { useEffect, useRef, useState } from 'react'

/**
 * 앱 콜드 스타트 인트로 스플래시 (약 3.4초).
 * 라이트 테마 배경에서 PWA 앱 아이콘이 중앙에 페이드인되며 위로 떠오르고,
 * 이어 "Spindle" 워드마크가 아래에서 올라온다 → 앱 홈(라이트)으로 자연스럽게 디졸브.
 * 화면 아무 곳이나 탭하면 즉시 건너뛴다. prefers-reduced-motion이면 짧은 페이드만.
 */

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const HOLD_MS = REDUCED ? 1000 : 2900
const EXIT_MS = REDUCED ? 220 : 520

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false)
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useEffect(() => {
    const timers: number[] = []
    timers.push(window.setTimeout(() => setExiting(true), HOLD_MS))
    timers.push(window.setTimeout(finish, HOLD_MS + EXIT_MS))
    return () => timers.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 탭 시 즉시 건너뛰기 — 퇴장 연출만 짧게 태우고 끝낸다
  const skip = () => {
    if (doneRef.current) return
    setExiting(true)
    window.setTimeout(finish, EXIT_MS)
  }

  return (
    <div className={`intro${exiting ? ' intro--exit' : ''}`} role="status" aria-label="Spindle 시작하는 중" onClick={skip}>
      <div className="intro-hero">
        <img className="intro-appicon" src="/pwa-icon-512.png" alt="" draggable={false} />
        <span className="intro-logo">Spindle</span>
      </div>

      <div className="intro-dots" aria-hidden>
        <span className="intro-dot" style={{ animationDelay: '0s' }} />
        <span className="intro-dot" style={{ animationDelay: '.2s' }} />
        <span className="intro-dot" style={{ animationDelay: '.4s' }} />
      </div>
    </div>
  )
}
