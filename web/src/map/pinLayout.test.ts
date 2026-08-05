import { describe, expect, it } from 'vitest'
import { buildPinLayout, densityModeForKakao, densityModeForLocal, pinLayerOf, PIN_LAYER, type PinLayoutItem } from './pinLayout'

const item = (overrides: Partial<PinLayoutItem> & Pick<PinLayoutItem, 'id' | 'kind'>): PinLayoutItem => ({ screenX: 10, screenY: 10, positionX: 10, positionY: 10, ...overrides })
const tierOne = item({ id: 'tier-one', kind: 'curated', tier: 1 })
const curated = item({ id: 'curated', kind: 'curated', tier: 2 })
const standardA = item({ id: 'standard-a', kind: 'standard' })
const standardB = item({ id: 'standard-b', kind: 'standard' })

describe('지도 확대 단계', () => {
  it('카카오맵 레벨과 로컬 줌을 같은 세 단계로 바꾼다', () => {
    expect([densityModeForKakao(7), densityModeForKakao(5), densityModeForKakao(4)]).toEqual(['far', 'middle', 'near'])
    expect([densityModeForLocal(1.99), densityModeForLocal(2), densityModeForLocal(3.4)]).toEqual(['far', 'middle', 'near'])
  })
})

describe('buildPinLayout', () => {
  it('원거리에서는 티어 1만 보호하고 나머지를 묶는다', () => {
    const layout = buildPinLayout([tierOne, curated, standardA, standardB], 'far')
    expect(layout.visibleIds.has('tier-one')).toBe(true)
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
    const layout = buildPinLayout([{ ...standardA, selected: true }, standardB], 'far')
    expect([...layout.visibleIds].sort()).toEqual(['standard-a', 'standard-b'])
    expect(layout.clusters).toHaveLength(0)
  })
  it('입력 순서가 달라도 묶음 id와 구성은 같다', () => {
    expect(buildPinLayout([standardB, standardA], 'far').clusters).toEqual(buildPinLayout([standardA, standardB], 'far').clusters)
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
