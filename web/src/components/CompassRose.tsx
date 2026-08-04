import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

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
const LABEL_RADIUS = 112
/** 방위환 라벨 — 8방위 스냅과 일치 (docs/design/ocean-compass light-a) */
const RING_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

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
      {/* 회전 방위환 — 종이 해도형 8방위 접힌 로즈 (docs/design/ocean-compass light-a) */}
      <div ref={discRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
        <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
          <path id="spindle-compass-light-a-minor" d="M160 9V16M174.54 9.72L173.86 16.69M188.94 11.85L187.58 18.72M203.06 15.38L201.03 22.08M216.78 20.27L214.1 26.74M229.95 26.47L226.66 32.65M242.46 33.91L238.59 39.73"/>
          <path id="spindle-compass-light-a-mid" d="M160 9V20M189.45 11.9L187.31 22.69M217.73 20.66L213.52 30.82M243.88 34.86L237.77 44.01"/>
          <path id="spindle-compass-light-a-major" d="M160 8V25"/>
          <path id="spindle-compass-light-a-cardinal-dark" d="M160 66L160 160L137 135Z"/>
          <path id="spindle-compass-light-a-cardinal-light" d="M160 66L183 135L160 160Z"/>
          <path id="spindle-compass-light-a-ordinal-dark" d="M160 89L160 160L145 143Z"/>
          <path id="spindle-compass-light-a-ordinal-light" d="M160 89L175 143L160 160Z"/>
          </defs>
          <circle cx="160" cy="160" r="153" fill="#ffffff" stroke="#17347f" strokeWidth="1.5"/>
          <circle cx="160" cy="160" r="147" fill="#f3f7ff" stroke="#8ba3cf" strokeWidth="1"/>
          <circle cx="160" cy="160" r="137" fill="#ffffff" stroke="#17347f" strokeWidth="1"/>
          <circle cx="160" cy="160" r="132" fill="none" stroke="#dbe6fa" strokeWidth="1"/>
          <g fill="none" stroke="#3a4c78" strokeWidth="0.85" strokeLinecap="round">
          <use href="#spindle-compass-light-a-minor"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(45 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(90 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(135 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(180 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(225 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(270 160 160)"/>
          <use href="#spindle-compass-light-a-minor" transform="rotate(315 160 160)"/>
          </g>
          <g fill="none" stroke="#17347f" strokeWidth="1.15" strokeLinecap="round">
          <use href="#spindle-compass-light-a-mid"/>
          <use href="#spindle-compass-light-a-mid" transform="rotate(90 160 160)"/>
          <use href="#spindle-compass-light-a-mid" transform="rotate(180 160 160)"/>
          <use href="#spindle-compass-light-a-mid" transform="rotate(270 160 160)"/>
          </g>
          <g fill="none" stroke="#2f5cff" strokeWidth="2" strokeLinecap="round">
          <use href="#spindle-compass-light-a-major"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(45 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(90 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(135 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(180 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(225 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(270 160 160)"/>
          <use href="#spindle-compass-light-a-major" transform="rotate(315 160 160)"/>
          </g>
          <g fill="none" stroke="#3ca8df" strokeWidth="1" strokeLinecap="round">
          <path d="M92 147Q109 137 126 147T160 147T194 147T228 147"/>
          <path d="M96 169Q112 159 128 169T160 169T192 169T224 169"/>
          <path d="M109 192Q122 184 135 192T161 192T187 192T213 192"/>
          </g>
          <g stroke="#17347f" strokeWidth="1" strokeLinejoin="round">
          <use href="#spindle-compass-light-a-cardinal-dark" fill="#17347f"/>
          <use href="#spindle-compass-light-a-cardinal-light" fill="#3ca8df"/>
          <use href="#spindle-compass-light-a-cardinal-dark" fill="#17347f" transform="rotate(90 160 160)"/>
          <use href="#spindle-compass-light-a-cardinal-light" fill="#3a4c78" transform="rotate(90 160 160)"/>
          <use href="#spindle-compass-light-a-cardinal-dark" fill="#17347f" transform="rotate(180 160 160)"/>
          <use href="#spindle-compass-light-a-cardinal-light" fill="#3ca8df" transform="rotate(180 160 160)"/>
          <use href="#spindle-compass-light-a-cardinal-dark" fill="#17347f" transform="rotate(270 160 160)"/>
          <use href="#spindle-compass-light-a-cardinal-light" fill="#3a4c78" transform="rotate(270 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-dark" fill="#17347f" transform="rotate(45 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-light" fill="#3a4c78" transform="rotate(45 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-dark" fill="#17347f" transform="rotate(135 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-light" fill="#3ca8df" transform="rotate(135 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-dark" fill="#17347f" transform="rotate(225 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-light" fill="#3a4c78" transform="rotate(225 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-dark" fill="#17347f" transform="rotate(315 160 160)"/>
          <use href="#spindle-compass-light-a-ordinal-light" fill="#3ca8df" transform="rotate(315 160 160)"/>
          </g>
          <path d="M160 66L160 103L151 93Z" fill="#FF7A45" stroke="#17347f" strokeWidth="1" strokeLinejoin="round"/>
          <circle cx="160" cy="160" r="13" fill="#ffffff" stroke="#17347f" strokeWidth="1.5"/>
          <circle cx="160" cy="160" r="5" fill="#1e4fd8"/>

          {/* 방위 라벨 — 위치는 원판을 따라 돌고 글자는 apply()에서 역회전시켜 항상 정립한다 */}
          <g fill="#17347f" textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.45px' }}>
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
                  dominantBaseline="middle"
                  fill={i === 0 ? '#FF7A45' : undefined}
                >
                  {label}
                </text>
              )
            })}
          </g>
        </svg>
      </div>

      {/* 고정 인덱스 — 회전하지 않는다. 화면 12시가 곧 알고리즘 입력 방위각이다. */}
      <svg
        viewBox="0 0 320 320"
        aria-hidden
        style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
      >
        <path d="M160 2L149 17L154 29L160 25L166 29L171 17Z" fill="#FF7A45" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M160 25V38" fill="none" stroke="#FF7A45" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  )
}
