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

export function pinLayerOf({
  selected,
  status,
  kind,
}: {
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

/**
 * 장소 사이의 화면 거리를 기준으로 디클러터링한다.
 *
 * 화면 좌상단에 고정된 격자를 쓰면 지도를 조금만 움직여도 격자 경계를 넘으며
 * 묶음 숫자가 바뀐다. 두 장소 사이의 거리는 팬 이동에 영향을 받지 않으므로,
 * 같은 확대 단계에서는 지도를 옮기거나 핀을 선택해도 묶음 구성이 유지된다.
 */
export function buildPinLayout(
  items: readonly PinLayoutItem[],
  mode: PinDensityMode,
): PinLayoutResult {
  const visibleIds = new Set<string>()
  if (mode === 'near') {
    for (const item of items) visibleIds.add(item.id)
    return { visibleIds, clusters: [] }
  }

  const clusterDistance = mode === 'far' ? 48 : 40
  const clusterDistanceSquared = clusterDistance * clusterDistance
  const candidates: PinLayoutItem[] = []

  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (shouldStayIndividual(item, mode)) {
      visibleIds.add(item.id)
      continue
    }
    candidates.push(item)
  }

  // 55곳 안팎의 작은 POI 풀이라 O(n²) 비교가 단순하고 충분히 가볍다.
  // 서로 가까운 장소를 연결한 뒤 연결된 덩어리를 하나의 묶음으로 만든다.
  const parents = candidates.map((_, index) => index)
  const findRoot = (index: number): number => {
    let root = index
    while (parents[root] !== root) root = parents[root]
    while (parents[index] !== index) {
      const parent = parents[index]
      parents[index] = root
      index = parent
    }
    return root
  }
  const connect = (left: number, right: number) => {
    const leftRoot = findRoot(left)
    const rightRoot = findRoot(right)
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
  }

  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const dx = candidates[left].screenX - candidates[right].screenX
      const dy = candidates[left].screenY - candidates[right].screenY
      if (dx * dx + dy * dy <= clusterDistanceSquared) connect(left, right)
    }
  }

  const groups = new Map<number, PinLayoutItem[]>()
  candidates.forEach((item, index) => {
    const root = findRoot(index)
    const group = groups.get(root) ?? []
    group.push(item)
    groups.set(root, group)
  })

  const clusters: PinCluster[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      visibleIds.add(group[0].id)
      continue
    }
    const itemIds = group.map((item) => item.id)
    const count = group.length
    clusters.push({
      id: `cluster:${itemIds.join('|')}`,
      itemIds,
      count,
      screenX: group.reduce((sum, item) => sum + item.screenX, 0) / count,
      screenY: group.reduce((sum, item) => sum + item.screenY, 0) / count,
      positionX: group.reduce((sum, item) => sum + item.positionX, 0) / count,
      positionY: group.reduce((sum, item) => sum + item.positionY, 0) / count,
    })
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id))
  return { visibleIds, clusters }
}
