import type { CSSProperties, ReactNode } from 'react'

export function ScreenFrame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="screen" style={style}>
      {children}
    </div>
  )
}

/** 밤하늘 별 장식 — 순수 장식이라 스크린리더에서 숨긴다 */
export function Stars() {
  const stars = [
    { top: '9%', left: '14%', size: 3, dur: '3.1s' },
    { top: '16%', left: '78%', size: 2, dur: '2.4s' },
    { top: '6%', left: '55%', size: 2, dur: '2.8s' },
    { top: '24%', left: '32%', size: 2, dur: '3.5s' },
    { top: '30%', left: '88%', size: 3, dur: '2.6s' },
    { top: '40%', left: '8%', size: 2, dur: '3.2s' },
  ]
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: i % 2 ? '#9dc0ff' : '#fff',
            animation: `glow ${s.dur} ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}
