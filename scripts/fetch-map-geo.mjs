// 명소 지도 베이스맵 생성기 — OSM 해안선·도로를 받아 web/src/map/busanGeo.ts를 만든다.
//
//   node scripts/fetch-map-geo.mjs            # Overpass에서 새로 받아 생성
//   node scripts/fetch-map-geo.mjs --cache 디렉터리   # 받아둔 coast.json/roads.json 재사용
//
// 빌드 타임 1회 실행이며 런타임에는 어떤 외부 호출도 없다 (생성물은 정적 TS 모듈).
// TourAPI 데이터가 아니므로 실시간 호출 규정과 무관하다.

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'web', 'src', 'map', 'busanGeo.ts')

// 지도 프레임 — 원도심 4개 구 + 영도 전체가 들어오는 범위
const B = { minLat: 35.038, maxLat: 35.135, minLon: 128.998, maxLon: 129.108 }
const VIEW_W = 1000
const COS = Math.cos(((B.minLat + B.maxLat) / 2) * (Math.PI / 180))
const VIEW_H = Math.round((VIEW_W * (B.maxLat - B.minLat)) / ((B.maxLon - B.minLon) * COS))

const OVERPASS = 'https://overpass-api.de/api/interpreter'
// 해안선은 조립을 위해 프레임보다 넉넉히 받는다
const Q_COAST = '[out:json][timeout:120];way["natural"="coastline"](35.02,128.96,35.16,129.14);out geom;'
const Q_ROADS = '[out:json][timeout:120];way["highway"~"^(motorway|trunk|primary|secondary)$"](35.03,128.98,35.15,129.12);out geom;'

async function load(name, query, cacheDir) {
  if (cacheDir) {
    const p = join(cacheDir, name + '.json')
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'))
  }
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`Overpass ${name} 실패: ${res.status}`)
  return res.json()
}

// ── 지오메트리 유틸 ──────────────────────────────────────────────

const key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7)

/** way 조각들을 끝점 매칭으로 폴리라인으로 이어붙인다 */
function assemble(ways) {
  const segs = ways.map((w) => w.geometry.map((p) => [p.lat, p.lon]))
  const lines = []
  while (segs.length) {
    let line = segs.shift()
    let grew = true
    while (grew) {
      grew = false
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]
        if (key(line[line.length - 1]) === key(s[0])) {
          line = line.concat(s.slice(1)); segs.splice(i, 1); grew = true; break
        }
        if (key(s[s.length - 1]) === key(line[0])) {
          line = s.concat(line.slice(1)); segs.splice(i, 1); grew = true; break
        }
      }
    }
    lines.push(line)
  }
  return lines
}

/** Douglas–Peucker 단순화 (경도는 cos 보정으로 등방화) */
function simplify(pts, tolDeg) {
  if (pts.length <= 2) return pts
  const sq = (p, a, b) => {
    const ax = a[1] * COS, ay = a[0], bx = b[1] * COS, by = b[0], px = p[1] * COS, py = p[0]
    const dx = bx - ax, dy = by - ay
    if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2
  }
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  const tol2 = tolDeg * tolDeg
  while (stack.length) {
    const [a, b] = stack.pop()
    let maxD = 0, maxI = -1
    for (let i = a + 1; i < b; i++) {
      const d = sq(pts[i], pts[a], pts[b])
      if (d > maxD) { maxD = d; maxI = i }
    }
    if (maxD > tol2) { keep[maxI] = 1; stack.push([a, maxI], [maxI, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

function project([lat, lon]) {
  const x = ((lon - B.minLon) / (B.maxLon - B.minLon)) * VIEW_W
  const y = ((B.maxLat - lat) / (B.maxLat - B.minLat)) * VIEW_H
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

function toPath(pts, close) {
  let d = ''
  let prev = null
  for (const p of pts) {
    const [x, y] = project(p)
    if (prev && x === prev[0] && y === prev[1]) continue
    d += (prev ? 'L' : 'M') + x + ' ' + y
    prev = [x, y]
  }
  return d + (close ? 'Z' : '')
}

function pointInRing(pt, ring) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1]
    if (yi > pt[0] !== yj > pt[0] && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const inFrame = ([lat, lon]) => lat >= B.minLat && lat <= B.maxLat && lon >= B.minLon && lon <= B.maxLon

// ── 메인 ────────────────────────────────────────────────────────

const cacheDir = process.argv.includes('--cache') ? process.argv[process.argv.indexOf('--cache') + 1] : null
const coast = await load('coast', Q_COAST, cacheDir)
const roads = await load('roads', Q_ROADS, cacheDir)

// 1. 해안선 → 육지 폴리곤
//    OSM 해안선은 진행 방향 왼쪽이 육지다. 본토 라인은 남서→북동으로 지나가므로
//    끝점에서 북쪽(위) 모서리를 크게 돌아 시작점으로 닫으면 육지 폴리곤이 된다.
const lines = assemble(coast.elements)
lines.sort((a, b) => b.length - a.length)
const landRings = []
for (const line of lines) {
  const closed = key(line[0]) === key(line[line.length - 1])
  if (closed) {
    if (line.length >= 12 && line.some(inFrame)) landRings.push(line)
  } else if (line.length > 500) {
    // 본토 해안선: 프레임 바깥 북쪽으로 크게 돌아 닫는다
    // (마진이 작으면 큰 화면에서 최소 줌일 때 닫힘선이 바다처럼 노출된다)
    const m = 0.6
    const closedLine = line.concat([
      [B.maxLat + m, line[line.length - 1][1]],
      [B.maxLat + m, Math.min(line[0][1], B.minLon) - m],
      [line[0][0], Math.min(line[0][1], B.minLon) - m],
    ])
    landRings.push(closedLine)
  }
}

// 닫힘 방향 검증 — 알려진 육지/바다 지점으로 확인
const probes = [
  { name: '남포동(육지)', pt: [35.0975, 129.029], land: true },
  { name: '흰여울(육지)', pt: [35.0788, 129.045], land: true },
  { name: '태종대(육지)', pt: [35.0537, 129.085], land: true },
  { name: '영도대교 아래 수로(바다)', pt: [35.0962, 129.0363], land: false },
  { name: '남항 수역(바다)', pt: [35.088, 129.028], land: false },
  { name: '부산항 내항(바다)', pt: [35.103, 129.048], land: false },
]
for (const { name, pt, land } of probes) {
  const hit = landRings.some((r) => pointInRing(pt, r))
  if (hit !== land) throw new Error(`육지/바다 검증 실패: ${name}`)
}

const simplifiedLand = landRings.map((r) => simplify(r, 0.00008)).filter((r) => r.length >= 4)
const LAND_PATH = simplifiedLand.map((r) => toPath(r, true)).join('')

// 2. 도로 — 등급 분류 + 프레임 밖 제거 + 단순화
const overSea = (pt) => !landRings.some((r) => pointInRing(pt, r))
const majors = [], minors = [], bridgeSegs = []
for (const w of roads.elements) {
  const pts = w.geometry.map((p) => [p.lat, p.lon])
  if (!pts.some(inFrame)) continue
  const simple = simplify(pts, 0.00025)
  if (simple.length < 2) continue
  const isBridge = !!w.tags.bridge
  // 바다를 건너는 교량은 별도 레이어 (영도대교·부산대교·남항대교·부산항대교).
  // 단순화 전 원본 꼭짓점 + 선분 중점으로 판정한다 (짧은 다리는 샘플이 성기면 놓친다).
  const samples = pts.flatMap((p, i) =>
    i === 0 ? [p] : [[(p[0] + pts[i - 1][0]) / 2, (p[1] + pts[i - 1][1]) / 2], p],
  )
  if (isBridge && samples.some(overSea)) {
    bridgeSegs.push({ pts: simple, name: w.tags.name || '' })
    continue
  }
  const major = /^(motorway|trunk|primary)$/.test(w.tags.highway)
  ;(major ? majors : minors).push(simple)
}

// 해상 교량 이름은 way name이 도로명일 수 있어 중심점 위치로 판별한다
// 영도대교·부산대교는 500m 간격이라 경도 반경을 좁게 잡아 구분한다
const BRIDGE_HINTS = [
  { name: '영도대교', lat: 35.0956, lon: 129.0366, rLat: 0.004, rLon: 0.0015 },
  { name: '부산대교', lat: 35.0952, lon: 129.0398, rLat: 0.006, rLon: 0.0015 },
  { name: '남항대교', lat: 35.0845, lon: 129.028, rLat: 0.008, rLon: 0.008 },
  { name: '부산항대교', lat: 35.1005, lon: 129.072, rLat: 0.02, rLon: 0.02 },
]
const bridges = bridgeSegs.map(({ pts, name }) => {
  const mid = pts[Math.floor(pts.length / 2)]
  const hint = BRIDGE_HINTS.find((h) => Math.abs(h.lat - mid[0]) < h.rLat && Math.abs(h.lon - mid[1]) < h.rLon)
  return { name: hint ? hint.name : name, d: toPath(pts, false) }
})

const ROADS_MAJOR = majors.map((p) => toPath(p, false)).join('')
const ROADS_MINOR = minors.map((p) => toPath(p, false)).join('')

// 3. TS 모듈로 출력
const ts = `// 자동 생성 파일 — scripts/fetch-map-geo.mjs (OSM 해안선·도로, ${new Date().toISOString().slice(0, 10)})
// 손으로 수정하지 말 것. 데이터 출처: © OpenStreetMap contributors (ODbL)

export const GEO = {
  minLat: ${B.minLat},
  maxLat: ${B.maxLat},
  minLon: ${B.minLon},
  maxLon: ${B.maxLon},
  w: ${VIEW_W},
  h: ${VIEW_H},
} as const

/** 위경도 → 지도 viewBox 좌표 (단말 내 계산 전용) */
export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon - GEO.minLon) / (GEO.maxLon - GEO.minLon)) * GEO.w,
    y: ((GEO.maxLat - lat) / (GEO.maxLat - GEO.minLat)) * GEO.h,
  }
}

/** 육지 폴리곤 (본토 + 영도 + 부속섬) */
export const LAND_PATH = ${JSON.stringify(LAND_PATH)}

/** 간선도로 (motorway·trunk·primary) */
export const ROADS_MAJOR = ${JSON.stringify(ROADS_MAJOR)}

/** 보조간선 (secondary) */
export const ROADS_MINOR = ${JSON.stringify(ROADS_MINOR)}

/** 해상 교량 — 영도를 잇는 다리들 */
export const BRIDGES: { name: string; d: string }[] = ${JSON.stringify(bridges)}
`
writeFileSync(OUT, ts)
console.log(`생성 완료 → ${OUT}`)
console.log(`  육지 링 ${simplifiedLand.length}개 (${simplifiedLand.reduce((s, r) => s + r.length, 0)}pt)`)
console.log(`  도로 major ${majors.length} / minor ${minors.length} / 해상교량 세그먼트 ${bridges.length}`)
console.log(`  viewBox 0 0 ${VIEW_W} ${VIEW_H}`)
