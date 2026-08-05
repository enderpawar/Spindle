import { describe, expect, it } from 'vitest'
import {
  buildPinLayout,
  densityModeForKakao,
  densityModeForLocal,
  pinLayerOf,
  PIN_LAYER,
  type PinLayoutItem,
} from './pinLayout'

function item(overrides: Partial<PinLayoutItem> & Pick<PinLayoutItem, 'id' | 'kind'>): PinLayoutItem {
  return {
    screenX: 10,
    screenY: 10,
    positionX: 10,
    positionY: 10,
    ...overrides,
  }
}

describe('지도 확대 단계', () => {
  it('카카오맵 레벨과 로컬 줌을 같은 세 단계로 바꾼다', () => {
    expect(densityModeForKakao(7)).toBe('far')
    expect(densityModeForKakao(5)).toBe('middle')
    expect(densityModeForKakao(4)).toBe('near')
    expect(densityModeForLocal(1.99)).toBe('far')
    expect(densityModeForLocal(2)).toBe('middle')
    expect(densityModeForLocal(3.4)).toBe('near')
  })
})

describe('buildPinLayout', () => {
  const tierOne = item({ id: 'tier-one', kind: 'curated', tier: 1 })
  const curated = item({ id: 'curated', kind: 'curated', tier: 2 })
  const standardA = item({ id: 'standard-a', kind: 'standard' })
  const standardB = item({ id: 'standard-b', kind: 'standard' })

  it('원거리에서는 티어 1만 보호하고 나머지를 묶는다', () => {
    const layout = buildPinLayout([tierOne, curated, standardA, standardB], 'far')
    expect(layout.visibleIds.has('tier-one')).toBe(true)
    expect(layout.clusters).toHaveLength(1)
    expect(layout.clusters[0].itemIds).toEqual(['curated', 'standard-a', 'standard-b'])
  })

  it('중거리에서는 큐레이션을 모두 보호하고 일반 명소만 묶는다', () => {
    const layout = buildPinLayout([tierOne, curated, standardA, standardB], 'middle')
    expect([...layout.visibleIds].sort()).toEqual(['curated', 'tier-one'])
    expect(layout.clusters[0].itemIds).toEqual(['standard-a', 'standard-b'])
  })

  it('근거리에서는 모든 핀을 개별 표시한다', () => {
    const layout = buildPinLayout([tierOne, curated, standardA], 'near')
    expect([...layout.visibleIds].sort()).toEqual(['curated', 'standard-a', 'tier-one'])
    expect(layout.clusters).toHaveLength(0)
  })

  it('선택 핀은 묶음에서 빠져 항상 개별 표시된다', () => {
    const layout = buildPinLayout([
      { ...standardA, selected: true },
      standardB,
    ], 'far')
    expect([...layout.visibleIds].sort()).toEqual(['standard-a', 'standard-b'])
    expect(layout.clusters).toHaveLength(0)
  })

  it('입력 순서가 달라도 묶음 id와 구성은 같다', () => {
    const forward = buildPinLayout([standardA, standardB], 'far')
    const reverse = buildPinLayout([standardB, standardA], 'far')
    expect(reverse.clusters).toEqual(forward.clusters)
  })

  it('같은 줌에서 지도를 팬해도 묶음 숫자와 구성이 바뀌지 않는다', () => {
    const beforePan = buildPinLayout([
      item({ id: 'a', kind: 'standard', screenX: 45, screenY: 45 }),
      item({ id: 'b', kind: 'standard', screenX: 47, screenY: 47 }),
      item({ id: 'c', kind: 'standard', screenX: 150, screenY: 80 }),
    ], 'far')
    const afterPan = buildPinLayout([
      item({ id: 'a', kind: 'standard', screenX: 49, screenY: 52 }),
      item({ id: 'b', kind: 'standard', screenX: 51, screenY: 54 }),
      item({ id: 'c', kind: 'standard', screenX: 154, screenY: 87 }),
    ], 'far')

    expect(beforePan.clusters.map(({ id, itemIds, count }) => ({ id, itemIds, count })))
      .toEqual(afterPan.clusters.map(({ id, itemIds, count }) => ({ id, itemIds, count })))
    expect([...beforePan.visibleIds]).toEqual([...afterPan.visibleIds])
  })

  it('확대 단계의 거리 밖인 핀은 같은 묶음으로 합치지 않는다', () => {
    const layout = buildPinLayout([
      item({ id: 'a', kind: 'standard', screenX: 0, screenY: 0 }),
      item({ id: 'b', kind: 'standard', screenX: 49, screenY: 0 }),
    ], 'far')

    expect(layout.clusters).toHaveLength(0)
    expect([...layout.visibleIds].sort()).toEqual(['a', 'b'])
  })
})

describe('pinLayerOf', () => {
  it('선택, 상태, 종류 순으로 레이어를 고정한다', () => {
    expect(pinLayerOf({ selected: true, status: 'busy', kind: 'standard' })).toBe(PIN_LAYER.selected)
    expect(pinLayerOf({ selected: false, status: 'busy', kind: 'standard' })).toBe(PIN_LAYER.busy)
    expect(pinLayerOf({ selected: false, status: 'good', kind: 'standard' })).toBe(PIN_LAYER.good)
    expect(pinLayerOf({ selected: false, kind: 'curated' })).toBe(PIN_LAYER.curated)
    expect(pinLayerOf({ selected: false, kind: 'standard' })).toBe(PIN_LAYER.standard)
  })
})
