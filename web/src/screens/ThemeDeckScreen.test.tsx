import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ExtraSpot } from '../api/extraSpots'
import { toDisplayPoi } from '../api/extraSpots'
import { DEPARTURES } from '../mock/pois'
import { ThemeCafeSection, ThemeDeckScreen } from './ThemeDeckScreen'
import { fetchThemeCafes } from './themeCafes'

const spots: ExtraSpot[] = [
  {
    id: 'tour-cafe',
    contentId: '1001',
    name: '바다 카페',
    category: '카페',
    district: '중구',
    lat: 35.1,
    lon: 129.03,
  },
  {
    id: 'tour-food',
    contentId: '1002',
    name: '시장 식당',
    category: '음식점',
    district: '중구',
    lat: 35.1,
    lon: 129.04,
  },
]

describe('ThemeDeckScreen 카페 섹션', () => {
  it('food 테마에서만 카페를 고르고 음식점은 제외한다', () => {
    const displaySpots = spots.map((spot) => toDisplayPoi(spot, DEPARTURES[0]!))
    const foodMarkup = renderToStaticMarkup(
      <ThemeCafeSection themeId="food" spots={displaySpots} onSelect={vi.fn()} />,
    )
    const seaMarkup = renderToStaticMarkup(
      <ThemeCafeSection themeId="sea" spots={displaySpots} onSelect={vi.fn()} />,
    )

    expect(foodMarkup).toContain('바다 카페')
    expect(foodMarkup).not.toContain('시장 식당')
    expect(seaMarkup).toBe('')
  })

  it('기존 extraSpots 세션 캐시 경로를 한 번만 호출해 카페만 가져온다', async () => {
    const loadExtraSpots = vi.fn().mockResolvedValue(spots)

    await expect(fetchThemeCafes(loadExtraSpots)).resolves.toEqual([spots[0]])
    expect(loadExtraSpots).toHaveBeenCalledTimes(1)
    expect(loadExtraSpots.mock.calls[0]![0]).toBeInstanceOf(Set)
  })

  it('카페 조회가 실패하면 빈 목록으로 조용히 처리한다', async () => {
    const loadExtraSpots = vi.fn().mockRejectedValue(new TypeError('offline'))

    await expect(fetchThemeCafes(loadExtraSpots)).resolves.toEqual([])
    expect(loadExtraSpots).toHaveBeenCalledTimes(1)
  })

  it('카페가 없으면 섹션을 감춘다', () => {
    expect(renderToStaticMarkup(
      <ThemeCafeSection themeId="food" spots={[]} onSelect={vi.fn()} />,
    )).toBe('')
  })

  it('카페가 로딩·실패로 감춰져도 큐레이션 섹션은 남는다', () => {
    const markup = renderToStaticMarkup(
      <ThemeDeckScreen
        initialTheme="food"
        journeyTarget={2}
        departure={DEPARTURES[0]!}
        onStart={vi.fn()}
        onSelect={vi.fn()}
        onNavigate={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(markup).toContain('이 테마에 들어 있는 장소')
    expect(markup).not.toContain('주변 카페')
    expect(markup).toContain('출처: ⓒ한국관광공사')
  })

  it('카페 카드에는 도장 배지가 없고 기존 상세 선택 흐름을 사용한다', () => {
    const onSelect = vi.fn()
    const cafe = toDisplayPoi(spots[0]!, DEPARTURES[0]!)
    const markup = renderToStaticMarkup(
      <ThemeCafeSection themeId="food" spots={[cafe]} onSelect={onSelect} />,
    )

    expect(markup).toContain('주변 카페')
    expect(markup).toContain('바다 카페')
    expect(markup).not.toContain('방문함')
  })
})
