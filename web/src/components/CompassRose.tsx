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
      {/* 회전 방위환 — 중앙 별 + 4방위 로즈 (docs/design/ocean-compass star-b).
          가운데 별은 앱 아이콘(pwa-icon.svg)의 4방위 별 마크와 같은 형태다 —
          PWA 아이콘·홈 브랜드 마크·스핀 FAB이 모두 이 별을 공유한다.
          색은 #2f5cff 하나로 두고 명암은 불투명도 단계로만 만든다 — 두 파랑을 맞붙이면
          접힌 면이 얼룩처럼 보인다. 주황은 회전부에 넣지 않는다(원판과 함께 돌면
          북쪽이 아닌 곳을 가리키게 된다). */}
      <div ref={discRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
        <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', display: 'block' }}>
          <circle cx="160" cy="160" r="150" fill="#f7f9ff" stroke="#c9d8f5" strokeWidth="1.5" />

          {/* 눈금 링 — 5°마다 짧은 눈금, 45°(8방위)마다 길고 진한 눈금 */}
          <g stroke="#2f5cff" strokeLinecap="round">
            {Array.from({ length: 72 }, (_, i) => {
              const deg = i * 5
              const major = deg % 45 === 0
              return (
                <line
                  key={deg}
                  x1="160"
                  y1={major ? 124 : 130}
                  x2="160"
                  y2="137"
                  strokeWidth={major ? 2 : 1}
                  strokeOpacity={major ? 0.55 : 0.3}
                  transform={`rotate(${deg} 160 160)`}
                />
              )
            })}
          </g>

          {/*
            4방위 날 — 각 날을 중앙 능선에서 좌우로 갈라 종이를 접은 듯한 2톤으로 만든다.
            같은 #2f5cff를 불투명도로만 나눠 색은 하나로 유지한다.
            꼭짓점 반지름 105, 밑변 반지름 14에 반폭 26.
          */}
          {[0, 90, 180, 270].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 160 160)`}>
              <path d="M160 55 L134 146 L160 146 Z" fill="#2f5cff" fillOpacity="0.5" />
              <path d="M160 55 L186 146 L160 146 Z" fill="#2f5cff" />
            </g>
          ))}

          {/* 방위 라벨 — 주방위는 크고 진하게, 대각은 작고 옅게. 글자는 apply()에서 역회전해 정립한다 */}
          <g textAnchor="middle" style={{ fontFamily: 'inherit' }}>
            {RING_LABELS.map((label, i) => {
              const cardinal = i % 2 === 0
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
                  fill={cardinal ? '#17347f' : '#8ba3cf'}
                  style={{ fontSize: cardinal ? 21 : 11, fontWeight: cardinal ? 800 : 700 }}
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
        {/*
          중앙 보스와 로고는 회전하지 않는다 — 원판만 돈다.
          고정 레이어가 회전부 위에 그려지므로 날 밑동(중심에서 28.8)도 함께 가려진다.
        */}
        <circle cx="160" cy="160" r="35" fill="#eef3ff" />
        <circle cx="160" cy="160" r="30" fill="#ffffff" stroke="#dbe6fa" strokeWidth="1" />
        <image href="/brand-mark-192.png" x="139" y="139" width="42" height="42" />

        <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M153 10 L160 23 L167 10 Z" fill="#FF7A45"/>
        </g>
      </svg>
    </div>
  )
}
