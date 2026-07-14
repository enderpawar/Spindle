import { useState } from 'react'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { THEMES, poisByTheme, themeInfo, type ThemeId } from '../engine/themes'
import { DIRECTIONS, type Poi } from '../mock/pois'
import { useVisited } from '../lib/visited'

interface Props {
  initialTheme: ThemeId
  onSelect: (poi: Poi) => void
  onNavigate: (tab: NavTab) => void
  onBack: () => void
}

/** 테마 덱 (Phase 7) — 바다/골목·시장/근현대·역사/야간/먹거리로 POI를 둘러본다. */
export function ThemeDeckScreen({ initialTheme, onSelect, onNavigate, onBack }: Props) {
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme)
  const visited = useVisited()
  const theme = themeInfo(themeId)
  const pois = poisByTheme(themeId)

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 4px', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--l-ink)', letterSpacing: -0.4 }}>테마로 떠나기</div>
      </header>

      {/* 테마 칩 */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: 9, padding: '12px 16px 4px', overflowX: 'auto', zIndex: 2 }}>
        {THEMES.map((t) => {
          const on = t.id === themeId
          return (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className="motion-card"
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 15px',
                borderRadius: 999,
                border: on ? 'none' : '1.5px solid var(--l-line)',
                background: on ? 'var(--l-primary)' : '#fff',
                color: on ? '#fff' : 'var(--l-ink-2)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: on ? '0 8px 18px -8px rgba(47,92,255,.55)' : 'none',
              }}
            >
              <span aria-hidden>{t.emoji}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 선택 테마 소개 */}
      <div style={{ padding: '10px 18px 0', zIndex: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--l-ink-3)' }}>
          <b style={{ color: theme.color, fontWeight: 900 }}>{theme.label}</b> · {theme.tagline} · {pois.length}곳
        </div>
      </div>

      {/* POI 덱 그리드 */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px calc(110px + env(safe-area-inset-bottom))' }}>
        <div key={themeId} className="motion-card-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {pois.map((poi) => {
            const dir = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
            const done = visited.has(poi.id)
            return (
              <button
                key={poi.id}
                onClick={() => onSelect(poi)}
                className="motion-card motion-card-enter"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ height: 112, borderRadius: 18, background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 135%)`, position: 'relative', overflow: 'hidden' }}>
                  <div aria-hidden style={{ position: 'absolute', right: -8, bottom: -10, fontSize: 58, opacity: 0.28 }}>
                    {theme.emoji}
                  </div>
                  <PoiPhoto contentId={poi.contentId} alt={poi.name} scrim />
                  {done && (
                    <div style={{ position: 'absolute', top: 9, right: 9, width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,37,64,.72)', display: 'grid', placeItems: 'center' }} aria-label="방문함">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                        <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '9px 2px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--l-ink)' }}>{poi.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                    {poi.category} · {poi.district}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
