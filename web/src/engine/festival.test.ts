import { describe, expect, it } from 'vitest'
import { DIRECTION_DISTRICTS, isFestivalOngoing, pickFestivalForDirection, type Festival } from './festival'

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
