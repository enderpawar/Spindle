import type { CSSProperties } from 'react'
import type { ThemeInfo, ThemeId } from '../engine/themes'
import type { Poi } from '../mock/pois'
import { PoiPhoto } from './PoiPhoto'
import './ThemeHero.css'

const TITLES: Record<ThemeId, string> = {
  sea: '파도 곁에서 만나는 부산',
  alley: '골목마다 발견하는 부산의 맛',
  history: '오래된 풍경 속 부산 이야기',
  night: '불빛 따라 걷는 부산의 밤',
  food: '부산의 맛을 따라 한 바퀴',
}

export function ThemeHero({ theme, representative, count, journeyTarget, onStart }: {
  theme: ThemeInfo
  representative?: Poi
  count: number
  journeyTarget: number
  onStart: (theme: ThemeId) => void
}) {
  return (
    <section className="theme-hero" aria-labelledby="theme-hero-title" style={{ '--theme-color': theme.color } as CSSProperties}>
      <div className="theme-hero-photo">
        <svg className="theme-hero-placeholder" viewBox="0 0 360 180" fill="none" aria-hidden="true">
          <circle cx="285" cy="45" r="25" fill="currentColor" opacity=".2" />
          <path d="M-20 135Q60 60 145 135T380 105M-20 160Q80 95 180 150T380 135" stroke="currentColor" strokeWidth="2" opacity=".25" />
        </svg>
        {representative && <PoiPhoto contentId={representative.contentId} alt={`${theme.label} 테마의 ${representative.name}`} />}
      </div>
      <div className="theme-hero-body">
        <h1 id="theme-hero-title">{TITLES[theme.id]}</h1>
        <p>{count}곳 <span aria-hidden="true">·</span> {journeyTarget}개의 여행 장면</p>
        <button type="button" className="theme-hero-start" onClick={() => onStart(theme.id)} disabled={count === 0}>
          <span>이 테마로 돌리기</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
        </button>
      </div>
    </section>
  )
}
