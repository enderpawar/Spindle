import { useEffect, useRef } from 'react'
import { THEMES, type ThemeId } from '../engine/themes'
import { ThemeIcon } from './ThemeIcon'
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
          <ThemeIcon id={theme.id} />
          <span>{theme.label}</span>
        </button>
      ))}
    </div>
  )
}
