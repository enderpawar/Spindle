import { BottomNav, type NavTab } from '../components/BottomNav'
import { DialSlider } from '../components/DialSlider'
import { ScreenFrame } from '../components/ScreenFrame'
import { kakaoLoadResult } from '../map/kakaoLoader'
import type { Departure } from '../mock/pois'

/** 지도 화면을 한 번이라도 연 뒤에만 값이 있다. 열기 전에는 아무것도 그리지 않는다. */
function MapSourceNote() {
  const result = kakaoLoadResult()
  if (!result) return null
  return (
    <div style={{ textAlign: 'center', padding: '4px 0 0', fontSize: 10.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>
      <div>{result.ok ? '지도: 카카오맵' : `지도: 내장 지도 — ${result.reason}`}</div>
      {/* 실패 시 카카오가 실제로 뭐라고 답했는지. 원인 파악용이라 실패했을 때만 나온다. */}
      {result.detail ? (
        <div style={{ marginTop: 4, fontSize: 9.5, fontWeight: 500, lineHeight: 1.45, wordBreak: 'break-all' }}>
          {result.detail}
        </div>
      ) : null}
    </div>
  )
}

interface Props {
  departure: Departure
  /** 이동시간 예산(분) — Infinity = 하루 */
  dial: number
  onDialChange: (minutes: number) => void
  onOpenDeparture: () => void
  onReplayGuide: () => void
  onNavigate: (tab: NavTab) => void
}

export function SettingsScreen({ departure, dial, onDialChange, onOpenDeparture, onReplayGuide, onNavigate }: Props) {
  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ padding: '18px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--l-ink)' }}>설정</div>
      </header>

      <div className="no-scrollbar motion-card-list" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px calc(110px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 출발점 */}
        <button
          onClick={onOpenDeparture}
          className="motion-card motion-card-enter"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', background: '#fff', border: 'none', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--l-ink-3)' }}>여행 모드 출발점</div>
            <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800, color: 'var(--l-ink)' }}>{departure.name}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        {/* 이동시간 기본값 */}
        <div style={{ padding: '16px 16px', background: '#fff', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--l-ink-3)', marginBottom: 10 }}>이동시간 기본값</div>
          <DialSlider minutes={dial} onChange={onDialChange} />
        </div>

        {/* 실제 홈 화면 위 코치마크 다시 보기 */}
        <button
          onClick={onReplayGuide}
          className="motion-card motion-card-enter"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', background: '#fff', border: 'none', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.25)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--l-ink)' }}>사용법 다시 보기</div>
            <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>실제 화면에서 기능 위치를 안내해요</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        {/* 신뢰 안내 */}
        <div style={{ padding: '16px 16px', background: 'var(--l-soft)', borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--l-ink-2)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2.2} aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
            </svg>
            위치와 방위는 휴대폰 안에서만 계산돼요. 서버로 보내지 않아요.
          </div>
          {/*
            스토어 심사 요건: 개인정보처리방침을 앱 안에서 열 수 있어야 한다.
            public/privacy.html은 빌드가 그대로 복사하므로 웹·앱 양쪽에서 같은 경로로 열린다
            (앱은 번들에 포함돼 오프라인에서도 표시된다).
          */}
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              alignSelf: 'flex-start',
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--l-primary)',
              textDecoration: 'underline',
            }}
          >
            개인정보처리방침
          </a>
        </div>

        {/*
          지도 공급자 표시. 카카오맵이 안 뜨면 사용자는 이유를 알 수 없고, 개발 머신이
          Windows라 실기기 콘솔도 볼 수 없어 원인 파악에 빌드를 여러 번 태웠다.
          내장 지도로 바뀐 사유는 사용자에게도 정당한 정보이므로 조용한 한 줄로 남긴다.
        */}
        <MapSourceNote />

        <div style={{ textAlign: 'center', padding: '12px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--l-ink-3)' }}>
          Spindle — 숨은 부산을 스핀하세요
        </div>
      </div>

      <BottomNav active="settings" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
