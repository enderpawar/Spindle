import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ExtraSpot } from '../api/extraSpots'
import { toDisplayPoi } from '../api/extraSpots'
import { DEPARTURES, POI_POOL } from '../mock/pois'
import {
  ExtraSpotsStatus,
  filterCuratedPois,
  filterExtraSpots,
  SpotsListCards,
} from './SpotsScreen'

vi.mock('../api/extraSpots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/extraSpots')>()
  return { ...actual, fetchExtraSpots: vi.fn() }
})

const extraSpots: ExtraSpot[] = [
  {
    id: 'tour-cafe-junggu',
    contentId: 'cafe-junggu',
    name: '중구 바다 카페',
    category: '카페',
    district: '중구',
    lat: 35.1,
    lon: 129.03,
    address: '부산 중구 바닷길',
  },
  {
    id: 'tour-cafe-yeongdo',
    contentId: 'cafe-yeongdo',
    name: '영도 언덕 카페',
    category: '카페',
    district: '영도구',
    lat: 35.08,
    lon: 129.05,
  },
  {
    id: 'tour-food-junggu',
    contentId: 'food-junggu',
    name: '중구 시장 음식점',
    category: '음식점',
    district: '중구',
    lat: 35.1,
    lon: 129.04,
  },
]

const emptyStatusMap = new Map()
const emptyNoticeMap = new Map<string, string>()

function renderCards(spots: readonly ExtraSpot[]): string {
  const pois = spots.map((spot) => toDisplayPoi(spot, DEPARTURES[0]!))
  return renderToStaticMarkup(
    <SpotsListCards
      pois={pois}
      statusByPoiId={emptyStatusMap}
      closedNoticeByPoi={emptyNoticeMap}
      onSelect={vi.fn()}
    />,
  )
}

describe('SpotsScreen 카테고리 필터', () => {
  it('기본 전체 필터에서는 기존 큐레이션 목록을 유지한다', () => {
    const list = filterCuratedPois('전체', '전체')

    expect(list).toHaveLength(POI_POOL.length)
    expect(list).toContain(POI_POOL[0])
  })

  it('카페를 선택하면 큐레이션 카드가 사라지고 카페만 남는다', () => {
    const curated = filterCuratedPois('전체', '카페')
    const filtered = filterExtraSpots(extraSpots, '전체', '카페')
    const markup = renderCards(filtered)

    expect(curated).toEqual([])
    expect(markup).toContain('중구 바다 카페')
    expect(markup).toContain('영도 언덕 카페')
    expect(markup).not.toContain('중구 시장 음식점')
  })

  it('음식점을 선택하면 카페가 섞이지 않는다', () => {
    const filtered = filterExtraSpots(extraSpots, '전체', '음식점')
    const markup = renderCards(filtered)

    expect(markup).toContain('중구 시장 음식점')
    expect(markup).not.toContain('중구 바다 카페')
    expect(markup).not.toContain('영도 언덕 카페')
  })

  it('구 필터와 카테고리 필터를 AND로 적용한다', () => {
    const filtered = filterExtraSpots(extraSpots, '영도구', '카페')

    expect(filtered.map((spot) => spot.name)).toEqual(['영도 언덕 카페'])
  })

  it('불러온 결과가 0곳이면 빈 상태 안내를 표시한다', () => {
    const markup = renderToStaticMarkup(
      <ExtraSpotsStatus
        categoryFilter="카페"
        extraSpots={extraSpots}
        error={null}
        retrying={false}
        curatedCount={0}
        filteredCount={0}
        onRetry={vi.fn()}
      />,
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('이 조건에 맞는 곳이 없어요')
  })

  it('fetchExtraSpots 실패 상태에서도 카페 오류 문구와 재시도를 유지한다', () => {
    const markup = renderToStaticMarkup(
      <ExtraSpotsStatus
        categoryFilter="카페"
        extraSpots={null}
        error={new TypeError('Failed to fetch')}
        retrying={false}
        curatedCount={0}
        filteredCount={0}
        onRetry={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('관광공사 등록 명소를 더 불러오지 못했어요')
    expect(markup).toContain('다시 시도')
  })
})
