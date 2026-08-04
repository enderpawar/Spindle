import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { directionFromHeading } from '../mock/pois'

interface Props {
  disabled?: boolean
  onSpinningChange?: (spinning: boolean) => void
  /** 매 프레임 현재 방위각(0=북, 시계방향) — 라이브 방위 표시용 */
  onHeading?: (headingDeg: number) => void
  /** 관성 감속이 끝난 최종 방위각. 연출 각도 = 알고리즘 입력 각도 (PLAN Phase 2 원칙) */
  onSettle: (headingDeg: number) => void
  /**
   * 현장 모드 — 실제 기기 방위각을 주면 원판이 그 방위를 추종한다.
   * null이면 기존 드래그·플릭 스핀으로 동작한다 (여행 모드).
   */
  followHeading?: number | null
}

const FLING_THRESHOLD = 0.25 // deg/ms — 이 미만의 릴리즈는 스핀으로 치지 않음
const STOP_THRESHOLD = 0.02 // deg/ms — 정지 판정
const DECAY_TAU = 480 // ms — 감속 시정수 (초속 1.8deg/ms 기준 약 2.5바퀴)
const MAX_VELOCITY = 3.2
/** 방위 라벨이 놓이는 반지름 — 역회전 계산과 렌더가 같은 값을 써야 한다 */
const LABEL_RADIUS = 82
/** 해도 방위환 라벨 — 8방위 스냅과 일치하는 약어 + 방위각 (docs/design/ocean-compass) */
const RING_LABELS = ['N 000', 'NE 045', 'E 090', 'SE 135', 'S 180', 'SW 225', 'W 270', 'NW 315']

const polar = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180
  return [160 + r * Math.sin(rad), 160 - r * Math.cos(rad)] as const
}


export function CompassRose({ disabled, onSpinningChange, onHeading, onSettle, followHeading = null }: Props) {
  const following = followHeading !== null
  // 현장 모드에서는 드래그·플릭·버튼 스핀을 모두 막는다 — 방위의 출처는 기기뿐이다.
  const locked = disabled || following
  const wrapRef = useRef<HTMLDivElement>(null)
  const discRef = useRef<HTMLDivElement>(null)
  const rotation = useRef(0)
  const velocity = useRef(0)
  const raf = useRef(0)
  const dragging = useRef(false)
  const lastPointerAngle = useRef(0)
  const samples = useRef<{ t: number; r: number }[]>([])
  const spinning = useRef(false)
  const fallback = useRef<ReturnType<typeof setTimeout>>(undefined)
  // 매 프레임 setState를 피하려고 DOM을 직접 갱신한다 (원판 transform과 같은 방식).
  const labelRefs = useRef<(SVGTextElement | null)[]>([])
  const readoutRef = useRef<SVGTextElement>(null)

  const headingOf = (rot: number) => ((-rot % 360) + 360) % 360

  const apply = () => {
    if (discRef.current) discRef.current.style.transform = `rotate(${rotation.current}deg)`
    const heading = headingOf(rotation.current)

    // 원판이 돌아도 글자는 항상 정립시킨다 — 회전만 맡기면 아래쪽 라벨이 뒤집혀 읽히지 않는다.
    for (let i = 0; i < labelRefs.current.length; i += 1) {
      const el = labelRefs.current[i]
      if (!el) continue
      const [lx, ly] = polar(LABEL_RADIUS, i * 45)
      el.setAttribute('transform', `rotate(${-rotation.current} ${lx} ${ly})`)
    }
    if (readoutRef.current) {
      readoutRef.current.textContent = `${directionFromHeading(heading).label} ${String(Math.round(heading) % 360).padStart(3, '0')}°`
    }

    onHeading?.(heading)
  }

  const setSpinning = (value: boolean) => {
    if (spinning.current === value) return
    spinning.current = value
    onSpinningChange?.(value)
  }

  const startInertia = (initial: number) => {
    const v0 = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, initial))
    setSpinning(true)
    const r0 = rotation.current
    const t0 = performance.now()
    // 지수 감쇠의 폐형식 해 — rAF는 그리기만 담당하고, 물리는 경과 시간으로 계산한다.
    // 탭이 가려져 rAF가 멈춰도 setTimeout 폴백이 정확한 최종 각도로 정착시킨다.
    const duration = DECAY_TAU * Math.log(Math.abs(v0) / STOP_THRESHOLD)
    const rotationAt = (t: number) => r0 + v0 * DECAY_TAU * (1 - Math.exp(-t / DECAY_TAU))

    const finish = () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(fallback.current)
      rotation.current = rotationAt(duration)
      velocity.current = 0
      apply()
      setSpinning(false)
      onSettle(headingOf(rotation.current))
    }

    const step = (now: number) => {
      const t = now - t0
      if (t >= duration) {
        finish()
        return
      }
      rotation.current = rotationAt(t)
      velocity.current = v0 * Math.exp(-t / DECAY_TAU)
      apply()
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    fallback.current = setTimeout(() => {
      if (spinning.current) finish()
    }, duration + 50)
  }

  const spinFromKeyboard = () => {
    if (locked || spinning.current || dragging.current) return
    cancelAnimationFrame(raf.current)
    clearTimeout(fallback.current)
    startInertia(1.6 + Math.random() * 1.2)
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(fallback.current)
    },
    [],
  )

  // 현장 모드: 기기 방위를 원판에 반영한다. 바늘은 화면 12시에 고정돼 있으므로
  // 원판을 -heading 만큼 돌리면 바늘이 실제 기기가 가리키는 방위를 짚는다.
  // 359°→0° 같은 경계에서 한 바퀴 되감기지 않도록 항상 최단 경로로 이동한다.
  useEffect(() => {
    if (followHeading === null) return
    cancelAnimationFrame(raf.current)
    clearTimeout(fallback.current)
    const delta = ((-followHeading - rotation.current + 540) % 360) - 180
    rotation.current += delta
    velocity.current = 0
    apply()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply는 ref만 만지는 안정 함수다
  }, [followHeading])

  const pointerAngle = (e: PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
  }

  const handleDown = (e: PointerEvent) => {
    if (locked) return
    cancelAnimationFrame(raf.current)
    clearTimeout(fallback.current)
    setSpinning(false)
    dragging.current = true
    lastPointerAngle.current = pointerAngle(e)
    samples.current = [{ t: performance.now(), r: rotation.current }]
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleMove = (e: PointerEvent) => {
    if (!dragging.current) return
    const angle = pointerAngle(e)
    let delta = angle - lastPointerAngle.current
    delta = ((delta + 540) % 360) - 180
    rotation.current += delta
    lastPointerAngle.current = angle
    const now = performance.now()
    samples.current.push({ t: now, r: rotation.current })
    while (samples.current.length > 2 && now - samples.current[0].t > 90) samples.current.shift()
    apply()
  }

  const handleUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const now = performance.now()
    const first = samples.current[0]
    const lastSample = samples.current[samples.current.length - 1]
    const elapsed = Math.max(lastSample.t - first.t, 1)
    if (now - lastSample.t > 80) return // 멈춘 채로 손을 뗌 — 스핀 아님
    const v = (lastSample.r - first.r) / elapsed
    if (Math.abs(v) >= FLING_THRESHOLD) startInertia(v)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    spinFromKeyboard()
  }

  return (
    <div
      ref={wrapRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-label={following ? '기기 나침반 방향을 표시하는 원판' : '나침반 원판을 돌려 방향 정하기'}
      aria-disabled={locked || undefined}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        touchAction: 'none',
        cursor: locked ? 'default' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* 회전 방위환 — 해도 눈금형 (docs/design/ocean-compass proto-2) */}
      <div ref={discRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
        <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', display: 'block' }}>
          <circle cx="160" cy="160" r="154" fill="#ffffff" stroke="#dbe6fa" strokeWidth="2" />
          <circle cx="160" cy="160" r="143" fill="#ffffff" stroke="#17347f" strokeWidth="1.5" />
          <circle cx="160" cy="160" r="127" fill="none" stroke="#8ba3cf" strokeWidth="1" />
          <circle cx="160" cy="160" r="101" fill="#e8f0ff" stroke="#dbe6fa" strokeWidth="1.5" />

          {/* 10도 눈금 — 32방위 해도 로즈의 보조 눈금을 8방위 스핀용으로 줄인 것.
              회전 중 속도감을 주되 8방위보다 정밀해 보이지 않도록 라벨은 달지 않는다. */}
          <g stroke="#3a4c78" strokeLinecap="square">
            {Array.from({ length: 36 }, (_, i) => {
              const deg = i * 10
              const major = deg % 90 === 0
              const mid = deg % 30 === 0
              return (
                <line
                  key={deg}
                  x1="160"
                  y1="17"
                  x2="160"
                  y2={major ? 34 : mid ? 29 : 25}
                  strokeWidth={major ? 2.5 : 1}
                  transform={`rotate(${deg} 160 160)`}
                />
              )
            })}
          </g>

          {/* 8방위 스냅 지점 표시 */}
          <g stroke="#2f5cff" strokeWidth="2" opacity="0.7">
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="160" y1="42" x2="160" y2="59" transform={`rotate(${i * 45} 160 160)`} />
            ))}
          </g>

          {/* 방위 라벨 — 위치는 원판을 따라 돌지만 글자는 apply()에서 역회전시켜 항상 정립한다 */}
          <g fill="#17347f" textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fontFamily: 'inherit' }}>
            {RING_LABELS.map((label, i) => {
              const [lx, ly] = polar(LABEL_RADIUS, i * 45)
              return (
                <text
                  key={label}
                  ref={(el) => {
                    labelRefs.current[i] = el
                  }}
                  x={lx}
                  y={ly}
                  dominantBaseline="central"
                >
                  {label}
                </text>
              )
            })}
          </g>

          {/* 북방 표시 — 고정 인덱스보다 약하게 둬서 "결과"와 경쟁하지 않게 한다 */}
          <path d="M160 89 L151 109 L160 104 L169 109 Z" fill="#1e4fd8" />
        </svg>
      </div>

      {/* 고정 인덱스와 선택값 — 회전하지 않는다. 화면 12시가 곧 알고리즘 입력 방위각이다. */}
      <svg
        viewBox="0 0 320 320"
        aria-hidden
        style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
      >
        <path d="M143 5 H177 L169 18 H151 Z" fill="#ff7a45" />
        <path d="M151 18 L160 39 L169 18 Z" fill="#ffb38f" stroke="#ff7a45" strokeWidth="2" />
        <line x1="160" y1="39" x2="160" y2="69" stroke="#ff7a45" strokeWidth="2.5" />
        <line x1="151" y1="69" x2="169" y2="69" stroke="#ff7a45" strokeWidth="2.5" />

        <path
          d="M126 130 H194 Q208 130 208 144 V176 Q208 190 194 190 H126 Q112 190 112 176 V144 Q112 130 126 130 Z"
          fill="#ffffff"
          stroke="#2f5cff"
          strokeWidth="2"
        />
        <text x="160" y="153" fill="#8ba3cf" textAnchor="middle" style={{ fontSize: 10, fontWeight: 750, fontFamily: 'inherit' }}>
          선택 방위
        </text>
        <text
          ref={readoutRef}
          x="160"
          y="175"
          fill="#17347f"
          textAnchor="middle"
          style={{ fontSize: 18, fontWeight: 850, fontFamily: 'inherit' }}
        >
          북 000°
        </text>
      </svg>
    </div>
  )
}
