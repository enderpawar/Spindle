import { describe, expect, it } from 'vitest'
import {
  DIRECTION_DISTRICTS,
  festivalBoardFor,
  isFestivalOngoing,
  isFestivalUpcoming,
  pickFestivalForDirection,
  type Festival,
} from './festival'

const fest = (over: Partial<Festival>): Festival => ({
  contentId: 'c',
  title: '테스트 축제',
  startDate: '20260701',
  endDate: '20260731',
  district: '중구',
  ...over,
})

describe('festival matching', () => {
  it('방위→구 매핑이 POI_POOL에서 파생된다 (N은 중구 포함)', () => {
    expect(DIRECTION_DISTRICTS.N).toContain('중구')
    expect(DIRECTION_DISTRICTS.SE).toContain('영도구')
  })

  it('isFestivalOngoing 경계: 시작일·종료일 당일 포함', () => {
    const f = fest({ startDate: '20260708', endDate: '20260708' })
    expect(isFestivalOngoing(f, '20260708')).toBe(true)
    expect(isFestivalOngoing(f, '20260707')).toBe(false)
    expect(isFestivalOngoing(f, '20260709')).toBe(false)
  })

  it('형식이 깨진 날짜는 기간 밖으로 처리 (빈 문자열 등)', () => {
    expect(isFestivalOngoing(fest({ startDate: '', endDate: '' }), '20260708')).toBe(false)
  })

  it('isFestivalUpcoming: 시작 전만 true, 진행 중·종료는 false', () => {
    const f = fest({ startDate: '20260710', endDate: '20260712' })
    expect(isFestivalUpcoming(f, '20260709')).toBe(true)
    expect(isFestivalUpcoming(f, '20260710')).toBe(false)
    expect(isFestivalUpcoming(f, '20260713')).toBe(false)
    expect(isFestivalUpcoming(fest({ startDate: '', endDate: '' }), '20260709')).toBe(false)
  })

  it('진행 중이 있으면 진행 중만, 종료 임박 순으로 세운다', () => {
    const board = festivalBoardFor(
      [
        fest({ contentId: 'late', startDate: '20260701', endDate: '20260731' }),
        fest({ contentId: 'soon', startDate: '20260701', endDate: '20260710' }),
        fest({ contentId: 'next', startDate: '20260801', endDate: '20260805' }),
      ],
      '20260708',
    )
    expect(board.kind).toBe('ongoing')
    expect(board.festivals.map((f) => f.contentId)).toEqual(['soon', 'late'])
  })

  it('진행 중이 하나도 없으면 예정 축제로 대체하고 시작 빠른 순으로 세운다', () => {
    const board = festivalBoardFor(
      [
        fest({ contentId: 'sep', startDate: '20260901', endDate: '20260903' }),
        fest({ contentId: 'aug', startDate: '20260801', endDate: '20260805' }),
        fest({ contentId: 'past', startDate: '20260601', endDate: '20260605' }),
      ],
      '20260708',
    )
    expect(board.kind).toBe('upcoming')
    expect(board.festivals.map((f) => f.contentId)).toEqual(['aug', 'sep'])
  })

  it('진행 중도 예정도 없으면 빈 목록 (빈 상태 화면 유지)', () => {
    const board = festivalBoardFor([fest({ startDate: '20260601', endDate: '20260605' })], '20260708')
    expect(board.festivals).toEqual([])
  })

  it('방위+기간이 맞으면 축제를 반환한다', () => {
    const list = [fest({ contentId: 'a', district: '중구', startDate: '20260701', endDate: '20260720' })]
    expect(pickFestivalForDirection(list, 'N', '20260708')?.contentId).toBe('a')
  })

  it('구가 방위와 다르면 매칭하지 않는다', () => {
    const list = [fest({ district: '영도구' })]
    expect(pickFestivalForDirection(list, 'N', '20260708')).toBeNull()
  })

  it('기간이 지났으면 매칭하지 않는다', () => {
    const list = [fest({ district: '중구', startDate: '20260101', endDate: '20260201' })]
    expect(pickFestivalForDirection(list, 'N', '20260708')).toBeNull()
  })

  it('여러 개면 가장 곧 끝나는 축제를 고른다', () => {
    const list = [
      fest({ contentId: 'late', district: '중구', endDate: '20260731' }),
      fest({ contentId: 'soon', district: '중구', endDate: '20260710' }),
    ]
    expect(pickFestivalForDirection(list, 'N', '20260708')?.contentId).toBe('soon')
  })
})
