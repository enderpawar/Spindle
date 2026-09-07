import { useEffect, useRef } from 'react'
import { THEMES, type ThemeId } from '../engine/themes'
import './ThemeNavigation.css'

export function ThemeNavigation({ value, onChange }: {
  value: ThemeId
  onChange: (value: ThemeId) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const selected = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!container || !selected) return
    // 선택 항목만 가로 스크롤 영역 안으로 이동한다. 본문 스크롤 위치는 유지한다.
    const containerRect = container.getBoundingClientRect()
    const selectedRect = selected.getBoundingClientRect()
    if (selectedRect.left < containerRect.left) container.scrollLeft -= containerRect.left - selectedRect.left + 2
    else if (selectedRect.right > containerRect.right) container.scrollLeft += selectedRect.right - containerRect.right + 2
  }, [value])

  return (
    <div ref={containerRef} className="spin-category-switch theme-category-switch no-scrollbar" role="group" aria-label="여행 테마">
      {THEMES.map((theme) => (
        <button key={theme.id} type="button" aria-pressed={value === theme.id}
          className={value === theme.id ? 'is-active' : ''} onClick={() => onChange(theme.id)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {theme.id === 'sea' && <><path d="M3 8c3-4 6 4 9 0s6 4 9 0M3 13c3-4 6 4 9 0s6 4 9 0M3 18c3-4 6 4 9 0s6 4 9 0" /></>}
            {theme.id === 'alley' && <><path d="M3 10l2-6h14l2 6M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M5 13v7h14v-7M10 20v-5h4v5" /></>}
            {theme.id === 'history' && <><path d="M3 8l9-5 9 5H3ZM5 11v7M10 11v7M14 11v7M19 11v7M3 21h18" /></>}
            {theme.id === 'night' && <><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /><path d="M17 3v4M15 5h4" /></>}
            {theme.id === 'food' && <><path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-4 3-4 8 0 9" /></>}
          </svg>
          <span>{theme.label}</span>
        </button>
      ))}
    </div>
  )
}
