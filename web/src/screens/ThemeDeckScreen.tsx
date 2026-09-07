import { useEffect, useMemo, useState } from 'react'
import { toDisplayPoi, type ExtraSpot } from '../api/extraSpots'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { ThemeNavigation } from '../components/ThemeNavigation'
import { ThemeHero } from '../components/ThemeHero'
import { poisByTheme, representativePoiForTheme, themeInfo, type ThemeId } from '../engine/themes'
import { directionOf, type Departure, type Poi } from '../mock/pois'
import { useVisited } from '../lib/visited'
import { fetchThemeCafes } from './themeCafes'

interface Props {
  initialTheme: ThemeId
  journeyTarget: number
  departure: Departure
  onStart: (themeId: ThemeId) => void
  onSelect: (poi: Poi) => void
  onNavigate: (tab: NavTab) => void
  onBack: () => void
}

export function ThemeCafeSection({ themeId, spots, onSelect }: {
  themeId: ThemeId
  spots: readonly Poi[]
  onSelect: (poi: Poi) => void
}) {
  const cafes = themeId === 'food' ? spots.filter((spot) => spot.category === '카페') : []
  if (cafes.length === 0) return null

  return (
    <section aria-labelledby="theme-cafe-heading" style={{ marginTop: 24 }}>
      <h2 id="theme-cafe-heading" className="theme-poi-heading">주변 카페</h2>
      <div className="motion-card-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {cafes.map((poi) => {
          const dir = directionOf(poi.direction)
          return (
            <button
              key={poi.id}
              onClick={() => onSelect(poi)}
              className="motion-card motion-card-enter"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ height: 112, borderRadius: 18, background: `linear-gradient(150deg, ${dir.color}, #1e4fd8 135%)`, position: 'relative', overflow: 'hidden' }}>
                <div aria-hidden style={{ position: 'absolute', right: -8, bottom: -10, fontSize: 58, opacity: 0.28 }}>☕</div>
                <PoiPhoto contentId={poi.contentId} alt={poi.name} scrim variant="thumb" />
                {/* tour-* 방문 기록은 zone.slots 기반 StampScreen에 영향을 주지 않는다.
                    markVisited 흐름은 유지하되 카페 카드에는 도장 배지를 표시하지 않는다. */}
              </div>
              <div style={{ padding: '9px 2px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--l-ink)' }}>{poi.name}</div>
                <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: 'var(--l-ink-3)' }}>
                  {poi.category} · {poi.district}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** 테마 덱 (Phase 7) — 바다/골목·시장/근현대·역사/야간/먹거리로 POI를 둘러본다. */
export function ThemeDeckScreen({ initialTheme, journeyTarget, departure, onStart, onSelect, onNavigate, onBack }: Props) {
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme)
  const [cafeSpots, setCafeSpots] = useState<ExtraSpot[] | null>(null)
  const visited = useVisited()
  const theme = themeInfo(themeId)
  const pois = poisByTheme(themeId)
  const representative = representativePoiForTheme(themeId)
  const extraDisplaySpots = useMemo(
    () => cafeSpots?.map((spot) => toDisplayPoi(spot, departure)) ?? [],
    [cafeSpots, departure],
  )

  useEffect(() => {
    if (themeId !== 'food' || cafeSpots !== null) return

    let active = true
    // fetchThemeCafes는 명소 화면과 같은 fetchAllOldTownPois 세션 캐시를 재사용한다.
    fetchThemeCafes()
      .then((spots) => {
        if (active) setCafeSpots(spots)
      })
    return () => {
      active = false
    }
  }, [cafeSpots, themeId])

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 4px', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn" style={{ width: 44, height: 44 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--l-ink)', letterSpacing: -0.4 }}>테마로 떠나기</div>
      </header>

      <ThemeNavigation value={themeId} onChange={setThemeId} />

      {/* 선택 테마 소개·사진 히어로·장소 목록은 한 흐름으로 함께 스크롤한다. */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        <ThemeHero key={themeId} theme={theme} representative={representative}
          count={pois.length} journeyTarget={journeyTarget} onStart={onStart} />

        {/* POI 덱 그리드 */}
        <div style={{ padding: '14px 16px 0' }}>
          <h2 className="theme-poi-heading">이 테마에 들어 있는 장소</h2>
          <div key={themeId} className="motion-card-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {pois.map((poi) => {
            const dir = directionOf(poi.direction)
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
                  <PoiPhoto contentId={poi.contentId} alt={poi.name} scrim variant="thumb" />
                  {done && (
                    <div style={{ position: 'absolute', top: 9, right: 9, width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,37,64,.72)', display: 'grid', placeItems: 'center' }} aria-label="방문함">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                        <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '9px 2px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--l-ink)' }}>{poi.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: 'var(--l-ink-3)' }}>
                    {poi.category} · {poi.district}
                  </div>
                </div>
              </button>
            )
          })}
          </div>
          <ThemeCafeSection themeId={themeId} spots={extraDisplaySpots} onSelect={onSelect} />
          <SourceLine />
        </div>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
