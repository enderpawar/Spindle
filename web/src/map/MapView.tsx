import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { BRIDGES, GEO, LAND_PATH, ROADS_MAJOR, ROADS_MINOR, project } from './busanGeo'
import { DIRECTIONS, type Departure, type Poi } from '../mock/pois'
import { MapPoiPreview } from '../components/MapPoiPreview'

/*
 * 원도심·영도 벡터 지도 — OSM 실측 해안선·도로 위에 POI 핀을 올린다.
 * 모든 좌표 계산은 단말 내에서만 일어난다 (절대 원칙 1).
 *
 * 카메라 모델: 화면px = (월드좌표 - c) * z + 화면중심.
 * 지형·도로는 canvas 래스터 레이어, 핀·라벨은 HTML 오버레이(화면좌표)로 그려
 * 줌 배율과 무관하게 텍스트·핀이 또렷하게 유지된다.
 */

interface Cam {
  cx: number
  cy: number
  z: number
}

interface Props {
  pois: Poi[]
  departure: Departure
  selectedId: string | null
  /** 핀 탭(id) 또는 빈 바다 탭(null) */
  onPick: (id: string | null) => void
  /** 선택 핀의 사진 프리뷰를 탭했을 때 상세 카드 열기 */
  onOpen?: (poi: Poi) => void
  /** 코스 미리보기 — 방문 순서대로 정렬된 poi id. 주어지면 출발→순서대로 경로선과 순번 핀을 그린다. */
  courseOrder?: string[]
}

/** 해상 교량 라벨 — 고가도로 세그먼트는 라벨을 달지 않는다 */
const BRIDGE_LABELS = ['영도대교', '남항대교', '부산대교', '부산항대교']

const DISTRICT_LABELS = [
  { name: '중구', lat: 35.1065, lon: 129.0305 },
  { name: '서구', lat: 35.0935, lon: 129.0105 },
  { name: '동구', lat: 35.1235, lon: 129.0455 },
  { name: '영도구', lat: 35.0685, lon: 129.0655 },
]

const SEA_LABELS = [
  { name: '부산 남항', lat: 35.0855, lon: 129.0225 },
  { name: '부산항', lat: 35.1075, lon: 129.0525 },
  { name: '남해', lat: 35.0465, lon: 129.0435 },
]

// 최대 줌은 절대값 — 도로 데이터(간선 위주) 밀도를 넘는 확대는 빈 화면만 남긴다
const Z_MAX = 6

// 바다 텍스처(월드 좌표)가 팬/줌에서도 화면을 덮도록 지역 경계 밖으로 두는 여백(월드 단위).
// 합성 레이어 크기와 직결되므로 뷰포트를 덮을 만큼만 둔다.
const SEA_MARGIN = 1500
const CANVAS_DPR_MAX = 1.5

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/** path d 문자열의 중간 꼭짓점 (교량 라벨 위치용) */
function pathMidpoint(d: string): { x: number; y: number } {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const n = Math.floor(nums.length / 2)
  const i = Math.max(0, (Math.floor(n / 2) - 1) * 2)
  return { x: nums[i], y: nums[i + 1] }
}

export function MapView({ pois, departure, selectedId, onPick, onOpen, courseOrder }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cam, setCam] = useState<Cam | null>(null)
  const camRef = useRef<Cam | null>(null)
  camRef.current = cam

  // 제스처 상태 (리렌더 불필요 — ref)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ cam: Cam; mid: { x: number; y: number }; dist: number; moved: number } | null>(null)
  const anim = useRef<number>(0)

  const terrainCanvasRef = useRef<HTMLCanvasElement>(null)
  const pathCache = useRef(new Map<string, Path2D>())
  const dragFrame = useRef<number>(0)
  const pendingCam = useRef<Cam | null>(null)

  // 세로 화면에서는 cover 줌이 너무 커서 전체가 안 보인다 —
  // 최소 줌은 "핀 전체 fit"으로, 최대는 cover 기준 배율로 잡는다.
  const coverZ = size.w ? Math.max(size.w / GEO.w, size.h / GEO.h) : 1
  const [zMin, setZMin] = useState(1)

  // 지도앱식 자유 팬: 카메라 중심을 지역(GEO) 범위 [0, span] 안 어디로든 옮길 수 있게 한다.
  // 콘텐츠를 화면 안에 가둬 고정하지 않는다 — 경계 밖은 바다가 채우고, "전체 보기"로 복귀한다.
  const clampAxis = (v: number, span: number): number => Math.min(Math.max(v, 0), span)

  const clamp = (c: Cam): Cam => {
    const z = Math.min(Math.max(c.z, zMin), Z_MAX)
    return { z, cx: clampAxis(c.cx, GEO.w), cy: clampAxis(c.cy, GEO.h) }
  }

  // 제스처 중에는 경계 밖으로 감쇠 오버스크롤 허용 → 손가락/마우스를 항상 따라 움직인다.
  // (release에서 clamp로 스냅백)
  const OVERSCROLL_PX = 90
  const clampSoft = (c: Cam): Cam => {
    const z = Math.min(Math.max(c.z, zMin), Z_MAX)
    const hard = clamp({ ...c, z })
    const over = OVERSCROLL_PX / z
    const soft = (raw: number, edge: number) => {
      const d = raw - edge
      return edge + Math.sign(d) * Math.min(Math.abs(d) * 0.5, over)
    }
    return { z, cx: soft(c.cx, hard.cx), cy: soft(c.cy, hard.cy) }
  }

  const toScreen = (wx: number, wy: number) => {
    if (!cam) return { x: -999, y: -999 }
    return { x: (wx - cam.cx) * cam.z + size.w / 2, y: (wy - cam.cy) * cam.z + size.h / 2 }
  }

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // POI 좌표 (월드)
  const pins = useMemo(
    () =>
      pois.map((p) => {
        const { x, y } = project(p.lat, p.lon)
        return { poi: p, x, y, color: DIRECTIONS.find((d) => d.id === p.direction)?.color ?? '#2f5cff' }
      }),
    [pois],
  )
  const dep = useMemo(() => project(departure.lat, departure.lon), [departure])

  // 코스 미리보기 — 방문 순서 맵(1-based)과 경로 색(코스 핀은 같은 방위색)
  const orderNum = useMemo(() => {
    const m = new Map<string, number>()
    courseOrder?.forEach((id, i) => m.set(id, i + 1))
    return m
  }, [courseOrder])
  const routeColor = pins.find((p) => orderNum.has(p.poi.id))?.color ?? '#2f5cff'

  // 초기 카메라: 표시 중인 핀 전체가 들어오게 (하단 카드 영역 고려해 아래 여백 크게)
  useEffect(() => {
    if (!size.w) return
    const fit = fitCam(pins.map((p) => [p.x, p.y] as [number, number]).concat([[dep.x, dep.y]]))
    setZMin(Math.min(fit.z, coverZ))
    if (!cam) setCam(fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, pins])

  function fitCam(pts: [number, number][]): Cam {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const padT = 64, padS = 44, padB = 196
    const z = Math.min((size.w - padS * 2) / Math.max(maxX - minX, 1), (size.h - padT - padB) / Math.max(maxY - minY, 1))
    return {
      z,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2 - (size.h / 2 - padT - (size.h - padT - padB) / 2) / z,
    }
  }

  const scheduleCam = (next: Cam) => {
    pendingCam.current = next
    camRef.current = next
    if (dragFrame.current) return
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = 0
      const latest = pendingCam.current
      if (latest) setCam(latest)
    })
  }

  const stopPan = () => {
    cancelAnimationFrame(anim.current)
    if (dragFrame.current) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = 0
    }
    const latest = pendingCam.current
    if (latest) {
      pendingCam.current = null
      camRef.current = latest
      setCam(latest)
    }
  }

  function animateTo(target: Cam, ms = 420) {
    cancelAnimationFrame(anim.current)
    if (dragFrame.current) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = 0
    }
    pendingCam.current = null
    const from = camRef.current
    if (!from) return
    const to = clamp(target)
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const k = ease(t)
      const next = { cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, z: from.z + (to.z - from.z) * k }
      camRef.current = next
      setCam(next)
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

  // 선택된 핀으로 부드럽게 이동 (카드 스와이프·핀 탭 공통)
  useEffect(() => {
    if (!selectedId || !cam) return
    const pin = pins.find((p) => p.poi.id === selectedId)
    if (!pin) return
    // 줌은 바꾸지 않는다 — 순수 팬만 한다.
    // 줌을 바꾸면 지형 SVG의 scale() 지오메트리가 매 프레임 다시 래스터화되는데,
    // 팬은 CSS transform(GPU 합성)·핀은 레이아웃이라 세 레이어가 어긋나며
    // "지도가 늦게 따라오는" 느낌을 만든다. 선택 핀은 줌과 무관하게 라벨이 보이므로
    // 확대 없이 가운데로만 부드럽게(합성 팬) 이동한다.
    const z = cam.z
    // 하단 카드에 가리지 않게 화면 38% 높이에 앵커
    const cy = pin.y - (size.h * 0.38 - size.h / 2) / z
    animateTo({ cx: pin.x, cy, z }, 360)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // 휠 줌 (passive:false 필요)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stopPan()
      const c = camRef.current
      if (!c) return
      cancelAnimationFrame(anim.current)
      const factor = Math.exp(-e.deltaY * 0.0022)
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const wx = (px - rect.width / 2) / c.z + c.cx
      const wy = (py - rect.height / 2) / c.z + c.cy
      const z = Math.min(Math.max(c.z * factor, zMin), Z_MAX)
      setCam((prev) => prev && clamp({ z, cx: wx - (px - rect.width / 2) / z, cy: wy - (py - rect.height / 2) / z }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zMin, size])

  // ── 포인터 제스처: 드래그 팬 + 두 손가락 핀치 ──
  const onPointerDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current)
    stopPan() // 진행 중 팬을 현재 보이는 위치에서 확정 → 드래그가 이어서 시작
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const c = camRef.current
    if (!c) return
    const mid = pts.length >= 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { ...pts[0] }
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    gesture.current = { cam: { ...c }, mid, dist, moved: gesture.current?.moved ?? 0 }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (pts.length >= 2) {
      // 핀치: 시작 시점 카메라 기준으로 배율·이동을 함께 계산
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const scale = g.dist > 0 ? dist / g.dist : 1
      const z = Math.min(Math.max(g.cam.z * scale, zMin), Z_MAX)
      const rect = wrapRef.current!.getBoundingClientRect()
      const wx = (g.mid.x - rect.left - rect.width / 2) / g.cam.z + g.cam.cx
      const wy = (g.mid.y - rect.top - rect.height / 2) / g.cam.z + g.cam.cy
      scheduleCam(clampSoft({ z, cx: wx - (mid.x - rect.left - rect.width / 2) / z, cy: wy - (mid.y - rect.top - rect.height / 2) / z }))
      g.moved += 10
    } else {
      const dx = pts[0].x - g.mid.x
      const dy = pts[0].y - g.mid.y
      g.moved = Math.max(g.moved, Math.hypot(dx, dy))
      scheduleCam(clampSoft({ z: g.cam.z, cx: g.cam.cx - dx / g.cam.z, cy: g.cam.cy - dy / g.cam.z }))
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      const wasTap = (gesture.current?.moved ?? 99) < 6
      gesture.current = null
      if (wasTap) onPick(null) // 빈 지도 탭 → 선택 해제
      else if (camRef.current) animateTo(camRef.current, 260) // 오버스크롤 스냅백
    } else if (gesture.current && camRef.current) {
      // 손가락 하나가 남으면 팬 기준점 재설정
      const pts = [...pointers.current.values()]
      gesture.current = { cam: { ...camRef.current }, mid: { ...pts[0] }, dist: 0, moved: gesture.current.moved }
    }
  }

  const zoomBy = (factor: number) => {
    stopPan()
    const c = camRef.current
    if (!c) return
    animateTo({ ...c, z: c.z * factor }, 260)
  }

  const bridgeLabels = useMemo(() => {
    const seen = new Map<string, { x: number; y: number; len: number }>()
    for (const b of BRIDGES) {
      if (!BRIDGE_LABELS.includes(b.name)) continue
      const prev = seen.get(b.name)
      if (!prev || b.d.length > prev.len) seen.set(b.name, { ...pathMidpoint(b.d), len: b.d.length })
    }
    return [...seen.entries()].map(([name, p]) => ({ name, x: p.x, y: p.y }))
  }, [])

  useLayoutEffect(() => {
    const canvas = terrainCanvasRef.current
    if (!canvas || !cam || !size.w || !size.h || typeof Path2D === 'undefined') return

    const dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR_MAX)
    const targetW = Math.max(1, Math.round(size.w * dpr))
    const targetH = Math.max(1, Math.round(size.h * dpr))
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pathOf = (d: string) => {
      let path = pathCache.current.get(d)
      if (!path) {
        path = new Path2D(d)
        pathCache.current.set(d, path)
      }
      return path
    }

    const panX = size.w / 2 - cam.cx * cam.z
    const panY = size.h / 2 - cam.cy * cam.z

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(cam.z, cam.z)

    const dot = document.createElement('canvas')
    dot.width = 26
    dot.height = 26
    const dotCtx = dot.getContext('2d')
    if (dotCtx) {
      dotCtx.fillStyle = 'rgba(255,255,255,.35)'
      dotCtx.beginPath()
      dotCtx.arc(4, 4, 1.1, 0, Math.PI * 2)
      dotCtx.fill()
      const pattern = ctx.createPattern(dot, 'repeat')
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(-SEA_MARGIN, -SEA_MARGIN, GEO.w + SEA_MARGIN * 2, GEO.h + SEA_MARGIN * 2)
      }
    }

    const strokePath = (d: string, stroke: string, width: number, alpha = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = stroke
      ctx.lineWidth = width / cam.z
      ctx.lineCap = 'round'
      ctx.stroke(pathOf(d))
      ctx.restore()
    }

    const land = pathOf(LAND_PATH)
    strokePath(LAND_PATH, 'rgba(255,255,255,.5)', 14)
    strokePath(LAND_PATH, 'rgba(255,255,255,.8)', 6)
    ctx.fillStyle = '#eff5fc'
    ctx.fill(land)
    strokePath(LAND_PATH, '#a8c6ec', 1)
    strokePath(ROADS_MINOR, '#ffffff', 1.1, 0.65)
    strokePath(ROADS_MAJOR, '#ffffff', 2)
    for (const bridge of BRIDGES) {
      strokePath(bridge.d, '#8fb4e4', 4)
      strokePath(bridge.d, '#ffffff', 2.2)
    }

    ctx.restore()
  }, [cam, size.h, size.w])

  if (!cam)
    return <div ref={wrapRef} style={{ position: 'absolute', inset: 0, background: '#c3dcf9' }} />

  // 라벨 노출은 절대 줌 기준 (world 1단위 ≈ 10m → z=2.6이면 1km ≈ 260px)
  const showPoiLabels = cam.z > 2.6
  const showBridgeLabels = cam.z > 1.3
  const districtOpacity = cam.z > 3.4 ? 0 : 1
  const selectedPin = selectedId ? pins.find((p) => p.poi.id === selectedId) : null
  const depScreen = toScreen(dep.x, dep.y)
  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(180deg, #cde3fb, #b7d4f6)', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* ── 지형 레이어 (canvas 래스터) ── */}
      <canvas
        ref={terrainCanvasRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size.w,
          height: size.h,
          pointerEvents: 'none',
        }}
        aria-hidden
      />

      {/* ── 경로선 (화면 좌표계 — 점선 간격이 줌과 무관) ──
          코스 모드: 출발→방문 순서대로 전체 경로. 그 외: 출발→선택 핀. */}
      {courseOrder && courseOrder.length > 0 ? (
        <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          {(() => {
            const seq = [depScreen]
            for (const id of courseOrder) {
              const pin = pins.find((p) => p.poi.id === id)
              if (pin) seq.push(toScreen(pin.x, pin.y))
            }
            const points = seq.map((s) => `${s.x},${s.y}`).join(' ')
            return <polyline points={points} fill="none" stroke={routeColor} strokeWidth={2.5} strokeDasharray="2 8" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} style={{ animation: 'mapdash 1.2s linear infinite' }} />
          })()}
        </svg>
      ) : selectedPin ? (
        <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          {(() => {
            const a = depScreen
            const b = toScreen(selectedPin.x, selectedPin.y)
            return (
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selectedPin.color} strokeWidth={2} strokeDasharray="3 7" strokeLinecap="round" opacity={0.85} style={{ animation: 'mapdash 1.2s linear infinite' }} />
            )
          })()}
        </svg>
      ) : null}

      {/* ── 라벨·핀 레이어 (HTML — 항상 또렷) ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {SEA_LABELS.map((l) => {
          const p = project(l.lat, l.lon)
          const s = toScreen(p.x, p.y)
          return (
            <span key={l.name} style={{ position: 'absolute', transform: `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`, fontSize: 11.5, fontStyle: 'italic', fontWeight: 600, letterSpacing: '0.35em', color: '#7fa8dd', whiteSpace: 'nowrap' }}>
              {l.name}
            </span>
          )
        })}
        {DISTRICT_LABELS.map((l) => {
          const p = project(l.lat, l.lon)
          const s = toScreen(p.x, p.y)
          return (
            <span key={l.name} style={{ position: 'absolute', transform: `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`, fontSize: 12, fontWeight: 800, letterSpacing: '0.5em', color: 'rgba(90,118,168,.55)', whiteSpace: 'nowrap', opacity: districtOpacity, transition: 'opacity .3s ease' }}>
              {l.name}
            </span>
          )
        })}
        {showBridgeLabels &&
          bridgeLabels.map((b) => {
            const s = toScreen(b.x, b.y)
            return (
              <span key={b.name} style={{ position: 'absolute', transform: `translate(${s.x}px,${s.y}px) translate(-50%,-160%)`, fontSize: 10, fontWeight: 700, color: '#5f83bd', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(240,247,255,.9)' }}>
                {b.name}
              </span>
            )
          })}

        {/* 출발점 마커 */}
        <div style={{ position: 'absolute', transform: `translate(${depScreen.x}px,${depScreen.y}px)` }}>
          <span style={{ position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(47,92,255,.22)', animation: 'maprip 2.4s ease-out infinite' }} />
          <span style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: '50%', background: '#2f5cff', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(20,50,140,.45)' }} />
          <span style={{ position: 'absolute', left: 12, top: -9, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,.92)', fontSize: 10.5, fontWeight: 800, color: '#17347f', whiteSpace: 'nowrap', boxShadow: '0 3px 10px -3px rgba(20,50,140,.35)' }}>
            출발 · {departure.name}
          </span>
        </div>

        {/* POI 핀 — 선택 핀이 맨 위. (21개뿐 → 컬링 없이 전부 렌더: 합성 팬 중 화면 밖 핀이 튀어들어오지 않게) */}
        {pins.map(({ poi, x, y, color }) => {
          const s = toScreen(x, y)
          const sel = poi.id === selectedId
          const n = orderNum.get(poi.id)
          const inCourse = n !== undefined
          const sizePx = sel ? 40 : inCourse ? 34 : poi.tier === 1 ? 31 : 26
          return (
            <div
              key={poi.id}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate3d(${s.x}px,${s.y}px,0)`,
                zIndex: sel ? 6 : poi.tier === 1 ? 3 : 2,
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            >
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onPick(poi.id)
                }}
                aria-label={poi.name}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                <svg
                  width={sizePx}
                  height={sizePx * 1.28}
                  viewBox="0 0 30 38"
                  style={{ display: 'block', transform: 'translate(-50%,-100%)', filter: sel ? `drop-shadow(0 6px 10px ${color}88)` : 'drop-shadow(0 3px 5px rgba(25,55,130,.35))', transition: 'width .18s ease, height .18s ease' }}
                  aria-hidden
                >
                  <path d="M15 1 C7.3 1 1.5 6.9 1.5 14.4 C1.5 24 12 33.5 15 36.6 C18 33.5 28.5 24 28.5 14.4 C28.5 6.9 22.7 1 15 1 Z" fill={color} stroke="#fff" strokeWidth={2.4} />
                  {inCourse ? (
                    <text x="15" y="19.4" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff">{n}</text>
                  ) : poi.tier === 3 ? (
                    <path d="M15 8.6 L16.7 12.9 L21 14.6 L16.7 16.3 L15 20.6 L13.3 16.3 L9 14.6 L13.3 12.9 Z" fill="#fff" />
                  ) : (
                    <circle cx="15" cy="14.4" r="4.6" fill="#fff" />
                  )}
                </svg>
                {(sel || showPoiLabels || inCourse) && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 3,
                      transform: 'translateX(-50%)',
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: '#1d3a75',
                      whiteSpace: 'nowrap',
                      padding: '2px 7px',
                      borderRadius: 7,
                      background: sel ? '#fff' : 'rgba(255,255,255,.82)',
                      boxShadow: sel ? '0 3px 10px -3px rgba(20,50,140,.4)' : 'none',
                    }}
                  >
                    {poi.name}
                  </span>
                )}
              </button>

              {/* 사진·핀·라벨이 같은 앵커 transform을 공유해 팬 애니메이션 중 어긋나지 않는다. */}
              {sel && <MapPoiPreview poi={poi} color={color} onOpen={onOpen} />}
            </div>
          )
        })}
      </div>

      {/* ── 컨트롤 ── */}
      <div style={{ position: 'absolute', right: 14, top: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="l-icon-btn" aria-label="확대" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBy(1.6)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
            <path d="M12 5 v14 M5 12 h14" />
          </svg>
        </button>
        <button className="l-icon-btn" aria-label="축소" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoomBy(1 / 1.6)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
            <path d="M5 12 h14" />
          </svg>
        </button>
        <button
          className="l-icon-btn"
          aria-label="전체 보기"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => animateTo(fitCam(pins.map((p) => [p.x, p.y] as [number, number]).concat([[dep.x, dep.y]])))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a9e" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M9 4 H4 v5 M15 4 h5 v5 M9 20 H4 v-5 M15 20 h5 v-5" />
          </svg>
        </button>
      </div>

      {/* 데이터 출처 (ODbL 표기 의무) */}
      <span style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 9, fontWeight: 600, color: 'rgba(70,100,150,.55)', pointerEvents: 'none' }}>
        지도 © OpenStreetMap
      </span>
    </div>
  )
}
