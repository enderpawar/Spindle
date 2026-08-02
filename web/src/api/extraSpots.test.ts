import { describe, expect, it } from 'vitest'
import type { Departure } from '../mock/pois'
import { toDisplayPoi, transformExtraSpots, type ExtraSpot } from './extraSpots'
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
    ])
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
