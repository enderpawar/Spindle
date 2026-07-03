import { useEffect } from 'react'
import spinningImg from '../assets/poses/spinning.png'
import { ScreenFrame } from '../components/ScreenFrame'
import { compassLoop } from '../mock/pois'
import type { Screen } from '../App'

const reelItems = [...compassLoop, ...compassLoop]

export function SpinScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onNavigate('reveal'), 2200)
    return () => clearTimeout(timer)
  }, [onNavigate])

  return (
    <ScreenFrame background="linear-gradient(180deg,#dcebff 0%,#c4dcff 60%,#b3d2ff 100%)">
      <button
        onClick={() => onNavigate('reveal')}
        style={{ position: 'absolute', inset: 0, border: 'none', background: 'none', cursor: 'pointer', zIndex: 1 }}
        aria-label="건너뛰기"
      />
      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', zIndex: 6 }}>
        <div style={{ font: `900 24px 'Noto Sans KR'`, color: '#17347f' }}>방향을 찾는 중…</div>
        <div style={{ marginTop: 8, font: `600 13px 'Noto Sans KR'`, color: '#5f88d6' }}>붐비는 해변은 건너뛰고 있어요</div>
      </div>
      <div style={{ position: 'absolute', top: 206, left: 0, right: 0, height: 320, display: 'grid', placeItems: 'center', zIndex: 5 }}>
        <svg width="320" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', animation: 'ringspin 1.2s linear infinite' }}>
          <path d="M160 24 A136 136 0 0 1 296 160" fill="none" stroke="#2f5cff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
          <path d="M160 296 A136 136 0 0 1 24 160" fill="none" stroke="#2f5cff" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
        </svg>
        <svg width="250" height="250" viewBox="0 0 250 250" style={{ position: 'absolute', animation: 'ringspinr 2s linear infinite' }}>
          <circle cx="125" cy="125" r="118" fill="none" stroke="#7ba7ee" strokeWidth={2} strokeDasharray="4 10" />
        </svg>
        <img src={spinningImg} style={{ position: 'absolute', width: 150, opacity: 0.28, transform: 'translateX(-40px)' }} alt="" />
        <img src={spinningImg} style={{ position: 'absolute', width: 165, opacity: 0.4, transform: 'translateX(24px)' }} alt="" />
        <img src={spinningImg} style={{ position: 'relative', width: 196, filter: 'drop-shadow(0 18px 22px rgba(30,79,216,.35))', animation: 'wobble 1.4s ease-in-out infinite' }} alt="" />
      </div>
      <div style={{ position: 'absolute', bottom: 210, left: 0, right: 0, zIndex: 6 }}>
        <div style={{ position: 'relative', overflow: 'hidden', height: 60, WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)' }}>
          <div style={{ display: 'flex', gap: 14, position: 'absolute', left: 0, top: 0, animation: 'reelL 1.1s linear infinite', willChange: 'transform' }}>
            {reelItems.map((label, i) => (
              <span
                key={i}
                style={{
                  flex: 'none',
                  padding: '16px 26px',
                  background: label === '북동' ? '#2f5cff' : '#fff',
                  borderRadius: 18,
                  font: `800 19px 'Noto Sans KR'`,
                  color: label === '북동' ? '#fff' : '#9db9e6',
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#17347f', transform: 'translateX(-50%)', opacity: 0.35 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 134, left: 0, right: 0, textAlign: 'center', font: `600 12.5px 'Noto Sans KR'`, color: '#5f7fbf', zIndex: 6 }}>
        접근성 · 운영상태 · 큐레이션 티어로 후보를 거르는 중
      </div>
    </ScreenFrame>
  )
}
