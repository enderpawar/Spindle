import './SpotsCategoryNavigation.css'

export function SpotsCategoryNavigation({ value, onChange }: {
  value: '전체' | '음식점' | '카페'
  onChange: (value: '전체' | '음식점' | '카페') => void
}) {
  return (
    <div className="spin-category-switch spots-category-switch" role="group" aria-label="장소 종류">
      {(['전체', '음식점', '카페'] as const).map((category) => (
        <button key={category} type="button" className={value === category ? 'is-active' : ''}
          aria-pressed={value === category} onClick={() => onChange(category)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {category === '전체' ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>
              : category === '음식점' ? <><path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-4 3-4 8 0 9" /></>
                : <><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 9h2a3 3 0 0 1 0 6h-2M7 3v2M12 3v2" /></>}
          </svg>
          <span>{category === '전체' ? '명소' : category}</span>
        </button>
      ))}
    </div>
  )
}
