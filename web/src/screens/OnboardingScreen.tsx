import { useState } from 'react'
import spinningImg from '../assets/poses/별이_spin.png'
import pointingImg from '../assets/poses/별이_pointing.png'
import { ScreenFrame } from '../components/ScreenFrame'

const slides = [
  {
    img: spinningImg,
    title: '돌리면, 방향이 정해줘요',
    body: '원판을 휙 돌려보세요.\n멈춘 방향이 오늘의 목적지가 돼요.',
  },
  {
    img: pointingImg,
    title: '덜 알려진 부산을 만나요',
    body: '붐비는 해변 대신, 원도심과 영도의\n골목이 당신을 기다리고 있어요.',
  },
]

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  const last = index === slides.length - 1

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 20px 0', zIndex: 2 }}>
        <button onClick={onDone} className="btn" style={{ background: 'none', border: 'none', color: 'var(--l-ink-3)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '6px 10px' }}>
          건너뛰기
        </button>
      </div>

      <div key={index} className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '0 36px', textAlign: 'center', zIndex: 2 }}>
        <div style={{ position: 'relative', width: 210, height: 210, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,147,255,.2), transparent 65%)', animation: 'glow 3s ease-in-out infinite' }} />
          <img src={slide.img} alt="" style={{ width: 168, filter: 'drop-shadow(0 16px 26px rgba(20,40,90,.22))', animation: 'bob 3.4s ease-in-out infinite' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, letterSpacing: -0.5, color: 'var(--l-ink)' }}>{slide.title}</h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, fontWeight: 500, color: 'var(--l-ink-2)', whiteSpace: 'pre-line' }}>{slide.body}</p>
        </div>
        {last && (
          <div style={{ padding: '13px 18px', borderRadius: 16, background: '#fff', border: '1px solid var(--l-line)', boxShadow: '0 8px 20px -16px rgba(20,40,90,.3)', fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: 'var(--l-ink-2)' }}>
            부산에 계시다면 <b style={{ color: 'var(--l-ink)' }}>현장 모드</b>(나침반)로,
            <br />
            아니라면 <b style={{ color: 'var(--l-ink)' }}>여행 모드</b>로 어디서든 돌릴 수 있어요
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '0 24px 34px', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {slides.map((_, i) => (
            <span key={i} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, background: i === index ? 'var(--l-primary)' : '#c9d6f0', transition: 'all .25s ease' }} />
          ))}
        </div>
        <button className="btn btn-blue" style={{ width: '100%', height: 58, fontSize: 17 }} onClick={() => (last ? onDone() : setIndex(index + 1))}>
          {last ? '시작하기' : '다음'}
        </button>
      </div>
    </ScreenFrame>
  )
}
