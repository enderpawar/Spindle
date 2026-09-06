import { describe, expect, it } from 'vitest'
import type { Departure } from '../mock/pois'
import {
  FOOD_SPOTS_PER_DISTRICT_LIMIT,
  toDisplayPoi,
  transformExtraSpots,
  type ExtraSpot,
} from './extraSpots'
import type { AreaPoi } from './tourapi'

const horizontalCoordinateField = ['ma', 'px'].join('')
const verticalCoordinateField = ['ma', 'py'].join('')

function areaPoi(overrides: Partial<AreaPoi> = {}): AreaPoi {
  return {
    contentid: '100',
    contenttypeid: '12',
    title: '테스트 관광지',
    addr1: '부산광역시 중구 테스트로 1',
    firstimage: '',
    sigungucode: '15',
    [horizontalCoordinateField]: '129.03',
    [verticalCoordinateField]: '35.10',
    ...overrides,
  } as AreaPoi
}

describe('transformExtraSpots', () => {
  it('허용 유형만 남기고 큐레이션·빈 제목·중복 ID·좌표 없는 항목을 제외한다', () => {
    const pois = [
      areaPoi(),
      areaPoi({ contentid: '101', contenttypeid: '14', title: ' 문화 공간 ', sigungucode: '5' }),
      areaPoi({ contentid: '102', contenttypeid: '39' }),
      areaPoi({ contentid: '103', title: '   ' }),
      areaPoi({ contentid: '100', title: '중복 관광지' }),
      areaPoi({ contentid: '104', [horizontalCoordinateField]: '' }),
      areaPoi({ contentid: '105' }),
    ]

    const result = transformExtraSpots(pois, new Set(['105']))

    expect(result).toEqual([
      {
        id: 'tour-100',
        contentId: '100',
        name: '테스트 관광지',
        category: '관광지',
        district: '중구',
        lat: 35.1,
        lon: 129.03,
        address: '부산광역시 중구 테스트로 1',
      },
      {
        id: 'tour-101',
        contentId: '101',
        name: '문화 공간',
        category: '문화시설',
        district: '동구',
        lat: 35.1,
        lon: 129.03,
        address: '부산광역시 중구 테스트로 1',
      },
      {
        id: 'tour-102',
        contentId: '102',
        name: '테스트 관광지',
        category: '음식점',
        district: '중구',
        lat: 35.1,
        lon: 129.03,
        address: '부산광역시 중구 테스트로 1',
      },
    ])
  })

  it('음식점 cat3가 카페면 카페로, 그 외와 누락은 음식점으로 표시한다', () => {
    const result = transformExtraSpots([
      areaPoi({ contentid: '201', contenttypeid: '39', cat3: 'A05020900', title: '카페 A' }),
      areaPoi({ contentid: '202', contenttypeid: '39', cat3: 'A05020100', title: '식당 B' }),
      areaPoi({ contentid: '203', contenttypeid: '39', cat3: undefined, title: '식당 C' }),
    ], new Set())
    const categoryById = new Map(result.map((spot) => [spot.contentId, spot.category]))

    expect(categoryById.get('201')).toBe('카페')
    expect(categoryById.get('202')).toBe('음식점')
    expect(categoryById.get('203')).toBe('음식점')
  })

  it('구당 상한을 지키면서 카페를 먼저 채우고 남는 자리에 식당을 넣는다', () => {
    const jungguCafes = Array.from(
      { length: FOOD_SPOTS_PER_DISTRICT_LIMIT - 1 },
      (_, index) => areaPoi({
        contentid: String(1000 + index),
        contenttypeid: '39',
        cat3: 'A05020900',
        title: `중구 카페 ${String(index).padStart(2, '0')}`,
        sigungucode: '15',
      }),
    )
    const jungguRestaurants = ['C 식당', 'A 식당', 'B 식당'].map((title, index) =>
      areaPoi({
        contentid: String(2000 + index),
        contenttypeid: '39',
        cat3: 'A05020100',
        title,
        sigungucode: '15',
      }),
    )
    const dongguCafes = Array.from(
      { length: FOOD_SPOTS_PER_DISTRICT_LIMIT + 1 },
      (_, index) => areaPoi({
        contentid: String(3000 + index),
        contenttypeid: '39',
        cat3: 'A05020900',
        title: `동구 카페 ${String(index).padStart(2, '0')}`,
        sigungucode: '5',
      }),
    )

    const result = transformExtraSpots(
      [...jungguRestaurants, ...dongguCafes.reverse(), ...jungguCafes.reverse()],
      new Set(),
    )
    const junggu = result.filter((spot) => spot.district === '중구')
    const donggu = result.filter((spot) => spot.district === '동구')

    expect(junggu).toHaveLength(FOOD_SPOTS_PER_DISTRICT_LIMIT)
    expect(donggu).toHaveLength(FOOD_SPOTS_PER_DISTRICT_LIMIT)
    expect(junggu.filter((spot) => spot.category === '카페')).toHaveLength(
      FOOD_SPOTS_PER_DISTRICT_LIMIT - 1,
    )
    expect(junggu.filter((spot) => spot.category === '음식점').map((spot) => spot.name)).toEqual([
      'A 식당',
    ])
  })

  it('음식점 출력 순서는 입력 순서와 무관하게 결정적이다', () => {
    const pois = [
      areaPoi({ contentid: '401', contenttypeid: '39', title: 'Z 식당' }),
      areaPoi({ contentid: '402', contenttypeid: '39', cat3: 'A05020900', title: 'B 카페' }),
      areaPoi({ contentid: '403', contenttypeid: '39', cat3: 'A05020900', title: 'A 카페' }),
      areaPoi({ contentid: '404', contenttypeid: '39', title: 'A 식당' }),
    ]

    const forward = transformExtraSpots(pois, new Set()).map((spot) => spot.contentId)
    const backward = transformExtraSpots([...pois].reverse(), new Set()).map((spot) => spot.contentId)

    expect(forward).toEqual(['403', '402', '404', '401'])
    expect(backward).toEqual(forward)
  })

  it('관광지와 문화시설에는 음식점 구당 상한을 적용하지 않는다', () => {
    const pois = Array.from(
      { length: FOOD_SPOTS_PER_DISTRICT_LIMIT + 5 },
      (_, index) => areaPoi({
        contentid: String(5000 + index),
        contenttypeid: index % 2 === 0 ? '12' : '14',
        title: `기존 명소 ${index}`,
      }),
    )

    expect(transformExtraSpots(pois, new Set())).toHaveLength(FOOD_SPOTS_PER_DISTRICT_LIMIT + 5)
  })
})

describe('toDisplayPoi', () => {
  const departure: Departure = {
    id: 'origin',
    name: '출발점',
    desc: '테스트 출발점',
    lat: 0,
    lon: 0,
  }

  function spot(overrides: Partial<ExtraSpot>): ExtraSpot {
    return {
      id: 'tour-200',
      contentId: '200',
      name: '추가 명소',
      category: '관광지',
      district: '중구',
      lat: 0.001,
      lon: 0,
      ...overrides,
    }
  }

  it('정북·정동 방위와 도보 시간을 단말에서 계산한다', () => {
    const north = toDisplayPoi(spot({ lat: 0.001, lon: 0 }), departure)
    const east = toDisplayPoi(spot({ lat: 0, lon: 0.001 }), departure)

    expect(north.direction).toBe('N')
    expect(east.direction).toBe('E')
    expect(north.walkMinutes).toBe(2)
    expect(east.walkMinutes).toBe(2)
  })

  it('주소와 보수적인 운영 상태를 상세 화면용 값으로 옮긴다', () => {
    const withAddress = toDisplayPoi(spot({ address: '부산광역시 중구' }), departure)
    const withoutAddress = toDisplayPoi(spot({ address: undefined }), departure)

    expect(withAddress.story).toBe('부산광역시 중구')
    expect(withAddress.tier).toBe(3)
    expect(withAddress.open).toEqual({ known: false, text: '운영시간은 상세에서 확인' })
    expect(withoutAddress.story).toBe('한국관광공사 등록 관광지')
  })
})
