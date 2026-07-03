import excitedImg from '../assets/poses/excited.png'
import { ScreenFrame } from '../components/ScreenFrame'
import type { Screen } from '../App'

export function RevealScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <ScreenFrame background="linear-gradient(180deg,#17347f,#0f2560)">
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <span style={{ position: 'absolute', top: 130, left: 56, width: 3, height: 3, background: '#fff', borderRadius: '50%', animation: 'glow 3s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: 200, right: 60, width: 2, height: 2, background: '#9dc0ff', borderRadius: '50%', animation: 'glow 2.4s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: 96, right: 100, width: 2, height: 2, background: '#fff', borderRadius: '50%', animation: 'glow 2.7s ease-in-out infinite' }} />
      </div>
      <div style={{ position: 'absolute', top: 96, left: 0, right: 0, textAlign: 'center', zIndex: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#2f5cff', borderRadius: 20, font: `800 14px 'Noto Sans KR'`, color: '#fff', boxShadow: '0 0 22px rgba(47,92,255,.6)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#bcd7ff">
            <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
          </svg>
          북동쪽에 뭔가 있어요
        </div>
      </div>
      <div style={{ position: 'absolute', top: 166, left: 44, right: 44, height: 420, zIndex: 5, display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,147,255,.4),transparent 62%)', animation: 'glow 2.6s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', top: 26, left: 40, fontSize: 20, color: '#fff', animation: 'sparkle 2.4s ease-in-out infinite' }}>✦</span>
        <span style={{ position: 'absolute', top: 80, right: 44, fontSize: 14, color: '#9dc0ff', animation: 'sparkle 2.9s ease-in-out infinite' }}>✦</span>
        <span style={{ position: 'absolute', bottom: 70, left: 54, fontSize: 13, color: '#9dc0ff', animation: 'sparkle 3.3s ease-in-out infinite' }}>✦</span>
        <div style={{ position: 'relative', width: 230, height: 300, borderRadius: 28, background: 'linear-gradient(160deg,#2c56c8,#12327f)', border: '1.5px solid rgba(160,190,255,.35)', boxShadow: '0 24px 50px -16px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 40%,rgba(255,255,255,.16) 50%,transparent 60%)' }} />
          <img src={excitedImg} style={{ width: 120, filter: 'drop-shadow(0 0 22px rgba(143,208,255,.7))', animation: 'bob 3s ease-in-out infinite' }} alt="" />
          <div style={{ font: `900 42px 'Baloo 2'`, color: 'rgba(255,255,255,.5)' }}>?</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 150, left: 0, right: 0, textAlign: 'center', zIndex: 6, padding: '0 40px' }}>
        <div style={{ font: `900 21px 'Noto Sans KR'`, color: '#fff' }}>숨은 곳을 찾았어요!</div>
        <div style={{ marginTop: 6, font: `600 13px 'Noto Sans KR'`, color: '#9dbaf0' }}>탭해서 오늘의 발견을 열어보세요</div>
      </div>
      <button
        onClick={() => onNavigate('result')}
        style={{ position: 'absolute', bottom: 70, left: 44, right: 44, height: 58, border: 'none', borderRadius: 20, background: '#fff', color: '#17347f', font: `800 17px 'Noto Sans KR'`, cursor: 'pointer', zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        ✨ 열어보기
      </button>
    </ScreenFrame>
  )
}
