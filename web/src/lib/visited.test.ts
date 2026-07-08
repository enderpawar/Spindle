import { afterEach, describe, expect, it } from 'vitest'
import { getVisited, isVisited, markVisited, resetVisited, unmarkVisited } from './visited'

afterEach(() => {
  resetVisited()
})

describe('visited store', () => {
  it('빈 상태에서 시작한다', () => {
    expect(isVisited('gukje-market')).toBe(false)
    expect(getVisited().size).toBe(0)
  })

  it('markVisited는 새 방문일 때만 true를 반환한다 (도장 획득 연출 트리거)', () => {
    expect(markVisited('huinnyeoul')).toBe(true)
    expect(markVisited('huinnyeoul')).toBe(false)
    expect(isVisited('huinnyeoul')).toBe(true)
  })

  it('getVisited 스냅샷은 변경 시에만 새 참조가 된다', () => {
    const before = getVisited()
    markVisited('taejongdae')
    const after = getVisited()
    expect(after).not.toBe(before) // 변경 → 새 Set (useSyncExternalStore 재구독)
    const again = getVisited()
    expect(again).toBe(after) // 무변경 → 동일 참조 (불필요한 리렌더 방지)
  })

  it('unmarkVisited는 기록을 제거한다', () => {
    markVisited('ibagu-road')
    unmarkVisited('ibagu-road')
    expect(isVisited('ibagu-road')).toBe(false)
  })

  it('resetVisited는 전체를 비운다', () => {
    markVisited('a')
    markVisited('b')
    resetVisited()
    expect(getVisited().size).toBe(0)
  })
})
