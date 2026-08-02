import pointingImg from '../assets/poses/별이_pointing.webp'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { HomeSpinContext } from '../components/HomeSpinContext'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { useVisited } from '../lib/visited'
import { THEMES, type ThemeId } from '../engine/themes'
import type { Departure } from '../mock/pois'
import { stampProgress } from '../mock/stamps'

export interface HomeScreenProps {
  departure: Departure
  dial: number
  candidateCount: number | null
  festivalOngoingCount: number | null
  onStartSpin: (minutes?: 20 | 40) => void
  onOpenDeparture: () => void
  onOpenTheme: (themeId: ThemeId) => void
  onOpenFestival: () => void
  onNavigate: (tab: NavTab) => void
}

export function HomeScreen({
  departure,
  dial,
  candidateCount,
  festivalOngoingCount,
  onStartSpin,
  onOpenDeparture,
  onOpenTheme,
  onOpenFestival,
  onNavigate,
}: HomeScreenProps) {
  const visited = useVisited()
  const progress = stampProgress(visited)

  const quickMenu = [
    {
      label: '명소',
      bg: 'var(--l-soft)',
      onClick: () => onNavigate('spots'),
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z" />
          <circle cx="12" cy="9" r="2.4" />
        </svg>
      ),
    },
    {
      label: '도장깨기',
      bg: 'var(--l-soft)',
      onClick: () => onNavigate('stamp'),
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12 l3 3 5-6" />
        </svg>
      ),
    },
    {
      label: '여행모드',
      bg: '#fff2ec',
      onClick: onOpenDeparture,
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--l-orange)" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 20 L20 20 M6 20 L6 10 L18 10 L18 20 M9 10 L12 4 L15 10" />
        </svg>
      ),
    },
    {
      label: '축제',
      bg: 'var(--l-soft)',
      onClick: onOpenFestival,
      icon: (
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary)" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 9 h18 M8 3 v4 M16 3 v4" />
        </svg>
      ),
    },
  ]

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      {/* 앱 바 */}
      <header className="home-header">
        <div className="home-brand">
          <img src="/brand-mark-192.png" alt="" className="home-brand-icon" />
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, color: 'var(--l-ink)' }}>Spindle</span>
        </div>
        <button
          onClick={onOpenDeparture}
          className="home-origin"
          data-guide="departure"
          style={{ cursor: 'pointer', minHeight: 44, border: 'none', background: 'transparent', padding: '8px 0 8px 12px', color: 'var(--l-ink-2)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1fa971', flex: 'none' }} />
          <span className="home-origin-label">{departure.name} 기준</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
            <path d="M7 10 l5 5 5-5" />
          </svg>
        </button>
      </header>

      <div className="home-scroll no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        {/* 히어로 배너 */}
        <div className="home-hero" data-guide="spin">
          <div aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: -40, right: 60, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
          <div className="home-hero-copy">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfe0ff' }}>붐비는 해변 말고,</div>
            <h1 className="home-hero-title">
              숨은 부산을
              <br />
              발견하세요
            </h1>
            <button
              onClick={() => onStartSpin()}
              className="btn"
              style={{ marginTop: 12, padding: '10px 18px', borderRadius: 16, background: '#fff', color: 'var(--l-primary-deep)', fontSize: 14, boxShadow: '0 8px 18px -6px rgba(0,0,0,.3)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--l-primary-deep)" strokeWidth={2.2} aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9 L10 14 L13 11 Z" fill="var(--l-primary-deep)" />
              </svg>
              지금 스핀하기
            </button>
          </div>
          <img
            src={pointingImg}
            alt=""
            className="home-hero-mascot"
          />
        </div>

        {/* 퀵 메뉴 */}
        <div className="home-quick-grid motion-card-list">
          {quickMenu.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="home-quick-button motion-card motion-card-enter"
            >
              <div className="home-quick-icon" style={{ background: item.bg }}>{item.icon}</div>
              <span className="home-quick-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* 테마로 떠나기 */}
        <div style={{ padding: '16px 20px 10px', fontSize: 15, fontWeight: 900, color: 'var(--l-ink)' }}>테마로 떠나기</div>
        <div className="home-theme-grid motion-card-list" data-guide="themes">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onOpenTheme(theme.id)}
              className="home-theme-card motion-card motion-card-enter"
              style={{ background: `linear-gradient(145deg, ${theme.color}, #1e4fd8 150%)` }}
            >
              <div aria-hidden style={{ position: 'absolute', right: -6, bottom: -8, fontSize: 46, opacity: 0.34 }}>
                {theme.emoji}
              </div>
              <div style={{ position: 'relative', fontSize: 14, fontWeight: 900 }}>{theme.label}</div>
              <div style={{ position: 'relative', marginTop: 3, fontSize: 10.5, fontWeight: 600, opacity: 0.92, lineHeight: 1.35 }}>{theme.tagline}</div>
            </button>
          ))}
        </div>

        {/* 도장깨기 진행 카드 */}
        <button
          onClick={() => onNavigate('stamp')}
          className="home-stamp-card motion-card motion-card-enter"
          data-guide="stamps"
        >
          <div className="home-stamp-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--l-ink)' }}>원도심 도장깨기</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--l-primary)' }}>
                {progress.collected}
                <span style={{ color: '#c3d3ee' }}>/{progress.total}</span>
              </span>
            </div>
            <div className="home-stamp-dots">
              {Array.from({ length: Math.min(progress.collected, 5) }, (_, i) => (
                <div key={i} className="home-stamp-dot home-stamp-dot--filled">
                  <img src="/stamp-mark-512.png" alt="" aria-hidden />
                </div>
              ))}
              {Array.from({ length: Math.max(0, Math.min(5 - progress.collected, 2)) + 2 }, (_, i) => (
                <div key={`empty-${i}`} className="home-stamp-dot home-stamp-dot--empty" />
              ))}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c3d3ee" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M9 6 l6 6 l-6 6" />
          </svg>
        </button>

        <HomeSpinContext
          departure={departure}
          dial={dial}
          candidateCount={candidateCount}
          festivalOngoingCount={festivalOngoingCount}
          onStartSpin={onStartSpin}
          onOpenFestival={onOpenFestival}
        />
        <SourceLine style={{ margin: '14px 16px 4px' }} />
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
