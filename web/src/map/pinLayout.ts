export type PinKind = 'curated' | 'standard'
export type PinDensityMode = 'far' | 'middle' | 'near'

export interface PinLayoutItem {
  id: string
  kind: PinKind
  tier?: number
  selected?: boolean
  screenX: number
  screenY: number
  /** 지도 공급자가 다시 중심으로 옮길 때 쓰는 좌표. 단말 안에서만 계산한다. */
  positionX: number
  positionY: number
}

export interface PinCluster {
  id: string
  itemIds: readonly string[]
  count: number
  screenX: number
  screenY: number
  positionX: number
  positionY: number
}

export interface PinLayoutResult {
  visibleIds: ReadonlySet<string>
  clusters: readonly PinCluster[]
}

export const PIN_LAYER = {
  cluster: 20,
  standard: 30,
  curated: 40,
  good: 55,
  busy: 60,
  selected: 100,
} as const

export function densityModeForKakao(level: number): PinDensityMode {
  if (level >= 7) return 'far'
  if (level >= 5) return 'middle'
  return 'near'
}

export function densityModeForLocal(zoom: number): PinDensityMode {
  if (zoom < 2) return 'far'
  if (zoom < 3.4) return 'middle'
  return 'near'
}

export function pinLayerOf({ selected, status, kind }: {
  selected: boolean
  status?: 'busy' | 'good'
  kind: PinKind
}): number {
  if (selected) return PIN_LAYER.selected
  if (status === 'busy') return PIN_LAYER.busy
  if (status === 'good') return PIN_LAYER.good
  return kind === 'curated' ? PIN_LAYER.curated : PIN_LAYER.standard
}

function shouldStayIndividual(item: PinLayoutItem, mode: PinDensityMode): boolean {
  if (item.selected || mode === 'near') return true
  if (mode === 'middle') return item.kind === 'curated'
  return item.kind === 'curated' && item.tier === 1
}

/** 화면 격자 기반 디클러터링. 1개짜리 셀은 핀을 유지하고 2개 이상만 묶는다. */
export function buildPinLayout(items: readonly PinLayoutItem[], mode: PinDensityMode): PinLayoutResult {
  const visibleIds = new Set<string>()
  if (mode === 'near') {
    for (const item of items) visibleIds.add(item.id)
    return { visibleIds, clusters: [] }
  }
  const cellSize = mode === 'far' ? 48 : 40
  const cells = new Map<string, PinLayoutItem[]>()
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (shouldStayIndividual(item, mode)) {
      visibleIds.add(item.id)
      continue
    }
    const key = `${Math.floor(item.screenX / cellSize)}:${Math.floor(item.screenY / cellSize)}`
    const cell = cells.get(key) ?? []
    cell.push(item)
    cells.set(key, cell)
  }
  const clusters: PinCluster[] = []
  for (const cell of cells.values()) {
    if (cell.length === 1) {
      visibleIds.add(cell[0].id)
      continue
    }
    const itemIds = cell.map((item) => item.id)
    const count = cell.length
    clusters.push({
      id: `cluster:${itemIds.join('|')}`,
      itemIds,
      count,
      screenX: cell.reduce((sum, item) => sum + item.screenX, 0) / count,
      screenY: cell.reduce((sum, item) => sum + item.screenY, 0) / count,
      positionX: cell.reduce((sum, item) => sum + item.positionX, 0) / count,
      positionY: cell.reduce((sum, item) => sum + item.positionY, 0) / count,
    })
  }
  clusters.sort((a, b) => a.id.localeCompare(b.id))
  return { visibleIds, clusters }
}
