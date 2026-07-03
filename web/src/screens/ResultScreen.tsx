import { ScreenFrame } from '../components/ScreenFrame'
import { IconStamp } from '../components/icons'
import { mockResult } from '../mock/pois'
import type { Screen } from '../App'

export function ResultScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const poi = mockResult

  return (
    <ScreenFrame background="#f4f8ff">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', zIndex: 20, background: '#f4f8ff' }}>
        <button onClick={() => onNavigate('home')} style={{ width: 40, height: 40, border: 'none', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px -6px rgba(20,40,90,.3)', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17347f" strokeWidth={2.4} strokeLinecap="round">
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ padding: '8px 16px', background: '#17347f', borderRadius: 20, font: `800 13px 'Noto Sans KR'`, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#8fd0ff">
            <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
          </svg>
          {poi.directionLabel}
        </div>
        <button style={{ width: 40, height: 40, border: 'none', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px -6px rgba(20,40,90,.3)', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
          </svg>
        </button>
      </div>

      <div style={{ position: 'absolute', top: 52, left: 0, right: 0, bottom: 86, overflowY: 'auto' }}>
        <div style={{ margin: '8px 18px 0', height: 196, borderRadius: 24, position: 'relative', background: 'linear-gradient(135deg,#3b7bf5,#1e4fd8)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1.6}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M3 17 l5-4 4 3 3-3 6 5" />
            </svg>
          </div>
          {poi.quietNow && (
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,.94)', borderRadius: 14, font: `800 11px 'Noto Sans KR'`, color: '#1fa971' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1fa971' }} />
              지금 한적해요
            </div>
          )}
          {poi.isPhotoSpot && (
            <div style={{ position: 'absolute', top: 12, right: 12, padding: '6px 11px', background: 'rgba(255,255,255,.94)', borderRadius: 14, font: `800 11px 'Noto Sans KR'`, color: '#e0603f' }}>📷 포토스팟</div>
          )}
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ font: `900 25px 'Noto Sans KR'`, color: '#17347f', letterSpacing: -0.5 }}>{poi.name}</div>
          <div style={{ marginTop: 4, font: `600 13px 'Noto Sans KR'`, color: '#8ba3cf' }}>
            {poi.category} · {poi.district} · 직선 {poi.straightKm}km · 도보 {poi.walkMinutes}분
          </div>

          <div style={{ marginTop: 14, padding: '14px 16px', background: '#fff', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.3)' }}>
            <div style={{ font: `800 12px 'Noto Sans KR'`, color: '#2f5cff', marginBottom: 5 }}>이 동네 이야기</div>
            <div style={{ font: `500 13.5px/1.55 'Noto Sans KR'`, color: '#3a4c78' }}>{poi.story}</div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#eef4ff', borderRadius: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#2f5cff', display: 'grid', placeItems: 'center', flex: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}>
                <path d="M9 12 l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div style={{ font: `600 12px/1.45 'Noto Sans KR'`, color: '#3f66c8' }}>
              <b style={{ fontWeight: 800, color: '#17347f' }}>왜 여기?</b> {poi.reason}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px dashed #b9cdf0', display: 'grid', placeItems: 'center' }}>
              <IconStamp color="#b9cdf0" size={16} />
            </div>
            <div style={{ font: `700 12px 'Noto Sans KR'`, color: '#8ba3cf' }}>
              방문하면 <b style={{ color: '#2f5cff' }}>{poi.stampZone} 도장</b>을 획득해요
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20, display: 'flex', gap: 12 }}>
        <button style={{ flex: 1, height: 56, border: 'none', borderRadius: 20, background: 'linear-gradient(145deg,#3b7bf5,#1e4fd8)', color: '#fff', font: `800 16px 'Noto Sans KR'`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z m0 9.5 a2.5 2.5 0 1 1 0-5 a2.5 2.5 0 0 1 0 5 z" />
          </svg>
          길찾기
        </button>
        <button
          onClick={() => onNavigate('spin')}
          style={{ width: 56, height: 56, border: '2px solid #d7e3f8', borderRadius: 20, background: '#fff', color: '#2f5cff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" strokeWidth={2.2} strokeLinecap="round">
            <path d="M3 12 a9 9 0 1 1 3 6.7" />
            <path d="M3 20 v-4 h4" />
          </svg>
        </button>
      </div>
    </ScreenFrame>
  )
}
