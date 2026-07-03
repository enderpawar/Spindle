import { useEffect } from 'react'
import excitedImg from '../assets/poses/excited.png'
import { ScreenFrame, Stars } from '../components/ScreenFrame'
import type { Recommendation } from '../mock/pois'

/** S3 방위 연출 — 자동으로 결과 카드로 넘어가고, 탭하면 즉시 스킵 (ui.md) */
export function RevealScreen({ rec, onOpen }: { rec: Recommendation; onOpen: () => void }) {
  const { direction } = rec

  useEffect(() => {
    const timer = setTimeout(onOpen, 3000)
    return () => clearTimeout(timer)
  }, [onOpen])

  return (
    <ScreenFrame>
      <Stars />
      <button onClick={onOpen} aria-label="바로 열어보기" style={{ position: 'absolute', inset: 0, border: 'none', background: 'none', cursor: 'pointer', zIndex: 1 }} />

      <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 32px', textAlign: 'center', zIndex: 2, pointerEvents: 'none' }}>
        <div>
          <div
            className="chip"
            style={{ background: direction.color, border: 'none', color: '#0f2540', fontSize: 14, fontWeight: 900, boxShadow: `0 0 26px ${direction.color}66` }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#0f2540" aria-hidden>
              <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
            </svg>
            {direction.label}쪽이에요
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 19, fontWeight: 800, lineHeight: 1.5, letterSpacing: -0.3 }}>{direction.message}</p>
          {rec.expandReason && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{rec.expandReason}</p>
          )}
        </div>

        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <div aria-hidden style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle, ${direction.color}55, transparent 62%)`, animation: 'glow 2.6s ease-in-out infinite' }} />
          <span aria-hidden style={{ position: 'absolute', top: 6, left: 18, fontSize: 19, color: '#fff', animation: 'sparkle 2.4s ease-in-out infinite' }}>✦</span>
          <span aria-hidden style={{ position: 'absolute', bottom: 40, right: 6, fontSize: 13, color: '#9dc0ff', animation: 'sparkle 3.1s ease-in-out infinite' }}>✦</span>
          <div
            style={{
              position: 'relative',
              width: 216,
              height: 278,
              borderRadius: 26,
              background: 'linear-gradient(160deg, rgba(255,255,255,.1), rgba(255,255,255,.03))',
              border: `1.5px solid ${direction.color}59`,
              boxShadow: '0 24px 50px -16px rgba(0,0,0,.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              overflow: 'hidden',
            }}
          >
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,.14) 50%, transparent 60%)' }} />
            <img src={excitedImg} alt="" style={{ width: 112, filter: `drop-shadow(0 0 22px ${direction.color}aa)`, animation: 'bob 3s ease-in-out infinite' }} />
            <div style={{ fontSize: 40, fontWeight: 900, color: 'rgba(255,255,255,.45)' }}>?</div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>숨은 곳을 찾았어요 — 탭해서 열어보세요</div>
      </div>
    </ScreenFrame>
  )
}
