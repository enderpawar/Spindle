import pointingImg from '../assets/poses/별이_pointing.webp'
import winkImg from '../assets/poses/별이_wink.webp'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { dailyMissionFor } from '../content/dailyMissions'
import { useVisited } from '../lib/visited'
import { THEMES, type ThemeId } from '../engine/themes'
import { directionOf, POI_POOL, type Departure, type Poi } from '../mock/pois'
import { stampProgress } from '../mock/stamps'

interface Props {
  departure: Departure
  onOpenDeparture: () => void
  onSelectPoi: (poi: Poi) => void
  onOpenTheme: (themeId: ThemeId) => void
  onOpenFestival: () => void
  onNavigate: (tab: NavTab) => void
}

// 오늘의 스핀 추천 — 숨은 명소(T3) 위주 픽 (목 단계 고정, Phase 2에서 추천 엔진 연동)
const todayPicks = ['kangkangee', 'ibagu-skyway', 'color-village', 'dongsam-shell']
  .map((id) => POI_POOL.find((p) => p.id === id))
  .filter((p): p is Poi => Boolean(p))

/** 카드 썸네일용 라인 스케치 (디자인 4a의 산·건물 아트) */
function SketchArt({ variant }: { variant: number }) {
  return (
    <svg viewBox="0 0 196 126" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }} aria-hidden>
      <g fill="none" stroke="#bcd7f7" strokeWidth={2}>
        {variant % 2 === 0 ? (
          <>
            <path d="M0 92 L40 68 L80 92 M40 68 L40 126" />
            <rect x="120" y="66" width="18" height="60" />
            <rect x="144" y="50" width="20" height="76" />
          </>
        ) : (
          <>
            <rect x="20" y="76" width="24" height="50" />
            <rect x="48" y="60" width="24" height="66" />
            <rect x="120" y="68" width="24" height="58" />
          </>
        )}
      </g>
    </svg>
  )
}

type HomeQuickKind = 'spots' | 'stamp' | 'travel' | 'festival'

/** 홈 바로가기 — 부산 해변에서 만나는 표식으로 통일한 듀오톤 아이콘 */
function HomeQuickIcon({ kind }: { kind: HomeQuickKind }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (kind === 'spots') {
    return (
      <svg {...common}>
        <path className="home-quick-icon-fill" d="M16 3.75a8 8 0 0 0-8 8c0 6 8 14.5 8 14.5s8-8.5 8-14.5a8 8 0 0 0-8-8Z" />
        <path d="M12.2 12.4c1.5-1.7 2.8-2.4 4.2-2.1 1.2.2 2.2 1.1 3.4.7" />
        <path className="home-quick-icon-accent" d="M11.5 15.6c1.5-1.3 3-1.7 4.4-1.2 1.1.4 2 .9 3.2.5" />
        <path d="M9.2 27.4c2 .8 4.3 1.2 6.8 1.2 2.6 0 4.9-.4 6.8-1.2" />
      </svg>
    )
  }

  if (kind === 'stamp') {
    return (
      <svg {...common}>
        <path className="home-quick-icon-fill" d="M7.2 23.5C4.5 18.8 5.4 11 10.1 7.2 12 5.7 14 5 16 5s4 .7 5.9 2.2c4.7 3.8 5.6 11.6 2.9 16.3H7.2Z" />
        <path d="M16 6.2v16.4M10.9 8.2l2.5 14.4M21.1 8.2l-2.5 14.4M7.5 23.5h17" />
        <path className="home-quick-icon-accent" d="m16 12.1 1.1 2.2 2.4.4-1.8 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.8-1.7 2.4-.4 1.1-2.2Z" />
      </svg>
    )
  }

  if (kind === 'travel') {
    return (
      <svg {...common}>
        <path className="home-quick-icon-accent" d="M17.3 8.4 27 5.5l-8.2 6.1M14.7 8.4 5 5.5l8.2 6.1" />
        <path className="home-quick-icon-fill" d="m13.2 9.8-2.6 15.5h10.8L18.8 9.8h-5.6Z" />
        <path d="M9.3 25.3h13.4M12.2 16.5h7.6M14.1 4.1h3.8v5.7h-3.8z" />
        <path className="home-quick-icon-accent" d="M12.3 28c2.5-1.1 5-1.1 7.5 0" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle className="home-quick-icon-fill" cx="16" cy="15" r="3.2" />
      <path d="M16 9V3.2M11.8 10.8 8 7M20.2 10.8 24 7M10 15H5M22 15h5" />
      <path className="home-quick-icon-accent" d="m16 15-5.2 5.2M16 15l5.2 5.2M7 26c2.9-2 5.8-2 8.7 0 2.9 2 5.8 2 9 0" />
    </svg>
  )
}

export function HomeScreen({ departure, onOpenDeparture, onSelectPoi, onOpenTheme, onOpenFestival, onNavigate }: Props) {
  const visited = useVisited()
  const progress = stampProgress(visited)
  const mission = dailyMissionFor()

  const quickMenu = [
    {
      label: '명소',
      kind: 'spots' as const,
      onClick: () => onNavigate('spots'),
    },
    {
      label: '도장깨기',
      kind: 'stamp' as const,
      onClick: () => onNavigate('stamp'),
    },
    {
      label: '여행모드',
      kind: 'travel' as const,
      onClick: onOpenDeparture,
    },
    {
      label: '축제',
      kind: 'festival' as const,
      onClick: onOpenFestival,
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
          <div className="home-hero-copy">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#cfe0ff' }}>붐비는 해변 말고,</div>
            <div className="home-hero-title">
              숨은 부산을
              <br />
              발견하세요
            </div>
            <button
              onClick={() => onNavigate('spin')}
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
              <div className={`home-quick-icon home-quick-icon--${item.kind}`}>
                <HomeQuickIcon kind={item.kind} />
              </div>
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
              data-theme={theme.id}
              style={{ background: `linear-gradient(145deg, ${theme.color}, #edf4ff 175%)` }}
            >
              <div aria-hidden className="home-theme-symbol">
                {theme.label.slice(0, 1)}
              </div>
              <div className="home-theme-title">{theme.label}</div>
              <div className="home-theme-tagline">{theme.tagline}</div>
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

        {/* 오늘의 스핀 추천 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--l-ink)' }}>오늘의 스핀 추천</div>
          <button onClick={() => onNavigate('spots')} className="home-section-link">
            더보기 ›
          </button>
        </div>
        <div className="home-pick-grid motion-card-list">
          {todayPicks.map((poi, i) => {
            const dir = directionOf(poi.direction)
            return (
              <button key={poi.id} onClick={() => onSelectPoi(poi)} className="home-pick-card motion-card motion-card-enter">
                <div className="home-pick-image" style={{ background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 130%)` }}>
                  <SketchArt variant={i} />
                  <PoiPhoto contentId={poi.contentId} alt={poi.name} scrim />
                </div>
                <div style={{ padding: '10px 2px 0' }}>
                  <div className="home-pick-title">{poi.name}</div>
                  <div className="home-pick-meta">
                    {poi.category} · {poi.district}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* 오늘의 한 칸 미션 */}
        <button
          type="button"
          onClick={() => onNavigate('spin')}
          className="home-mission-card motion-card motion-card-enter"
        >
          <span className="home-mission-copy">
            <span className="home-mission-label">오늘의 한 칸 미션</span>
            <strong className="home-mission-title">{mission.title}</strong>
            <span className="home-mission-description">{mission.description}</span>
            <span className="home-mission-cta">
              스핀하러 가기 <span aria-hidden>›</span>
            </span>
          </span>
          <img src={winkImg} alt="" className="home-mission-mascot" />
        </button>

        <SourceLine style={{ margin: '18px 20px 8px' }} />
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
