import { useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react'
import { DIRECTIONS } from '../mock/pois'

export interface CompassRoseHandle {
  /** 보조 "돌리기" 버튼용 — 무작위 초기 각속도로 스핀 */
  spin: () => void
}

interface Props {
  ref?: Ref<CompassRoseHandle>
  disabled?: boolean
  onSpinningChange?: (spinning: boolean) => void
  /** 매 프레임 현재 방위각(0=북, 시계방향) — 라이브 방위 표시용 */
  onHeading?: (headingDeg: number) => void
  /** 관성 감속이 끝난 최종 방위각. 연출 각도 = 알고리즘 입력 각도 (PLAN Phase 2 원칙) */
  onSettle: (headingDeg: number) => void
}

const FLING_THRESHOLD = 0.25 // deg/ms — 이 미만의 릴리즈는 스핀으로 치지 않음
const STOP_THRESHOLD = 0.02 // deg/ms — 정지 판정
const DECAY_TAU = 480 // ms — 감속 시정수 (초속 1.8deg/ms 기준 약 2.5바퀴)
const MAX_VELOCITY = 3.2

const polar = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180
  return [160 + r * Math.sin(rad), 160 - r * Math.cos(rad)] as const
}

const arcPath = (r: number, a1: number, a2: number) => {
  const [x1, y1] = polar(r, a1)
  const [x2, y2] = polar(r, a2)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
}

export function CompassRose({ ref, disabled, onSpinningChange, onHeading, onSettle }: Props) {
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

  const headingOf = (rot: number) => ((-rot % 360) + 360) % 360

  const apply = () => {
    if (discRef.current) discRef.current.style.transform = `rotate(${rotation.current}deg)`
    onHeading?.(headingOf(rotation.current))
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

  useImperativeHandle(ref, () => ({
    spin: () => {
      if (disabled || spinning.current || dragging.current) return
      cancelAnimationFrame(raf.current)
      clearTimeout(fallback.current)
      startInertia(1.6 + Math.random() * 1.2)
    },
  }))

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(fallback.current)
    },
    [],
  )

  const pointerAngle = (e: PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
  }

  const handleDown = (e: PointerEvent) => {
    if (disabled) return
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

  return (
    <div
      ref={wrapRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        touchAction: 'none',
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* 고정 바늘 — 원판 위 12시 방향, 여기가 "가리키는 곳" */}
      <svg
        aria-hidden
        viewBox="0 0 40 26"
        style={{ position: 'absolute', top: '-2.5%', left: '50%', width: '11%', transform: 'translateX(-50%)', zIndex: 3, filter: 'drop-shadow(0 4px 10px rgba(255,122,69,.55))' }}
      >
        <path d="M20 26 L8 4 Q20 -4 32 4 Z" fill="var(--accent)" />
        <path d="M20 26 L8 4 Q20 -4 32 4 Z" fill="url(#needleShine)" opacity=".35" />
        <defs>
          <linearGradient id="needleShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* 회전 원판 */}
      <div ref={discRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
        <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <radialGradient id="discFace" cx="50%" cy="38%" r="75%">
              <stop offset="0" stopColor="rgba(47,92,255,.08)" />
              <stop offset="0.55" stopColor="rgba(47,92,255,.03)" />
              <stop offset="1" stopColor="rgba(47,92,255,0)" />
            </radialGradient>
          </defs>

          <circle cx="160" cy="160" r="154" fill="#ffffff" stroke="var(--l-line)" strokeWidth="1.5" />
          <circle cx="160" cy="160" r="154" fill="url(#discFace)" />
          <circle cx="160" cy="160" r="120" fill="none" stroke="var(--l-line)" strokeWidth="1" />
          <circle cx="160" cy="160" r="62" fill="rgba(47,92,255,.03)" stroke="var(--l-line)" strokeWidth="1" />

          {DIRECTIONS.map((dir, i) => {
            const angle = i * 45
            const cardinal = i % 2 === 0
            const [tx, ty] = polar(96, angle)
            const [mx1, my1] = polar(146, angle)
            const [mx2, my2] = polar(134, angle)
            const [bx1, by1] = polar(146, angle + 22.5)
            const [bx2, by2] = polar(140, angle + 22.5)
            return (
              <g key={dir.id}>
                {/* 림 방위 색 아크 */}
                <path d={arcPath(150, angle - 16, angle + 16)} stroke={dir.color} strokeWidth="7" fill="none" opacity="0.5" strokeLinecap="round" />
                {/* 눈금 — 방위선(굵게) + 경계선(얇게) */}
                <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="rgba(90,118,168,.5)" strokeWidth={cardinal ? 2.5 : 1.5} strokeLinecap="round" />
                <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="rgba(139,163,207,.45)" strokeWidth="1" />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${angle} ${tx} ${ty})`}
                  style={{ fill: cardinal ? '#17347f' : '#8ba3cf', fontSize: cardinal ? 19 : 12, fontWeight: 800, fontFamily: 'inherit' }}
                >
                  {dir.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
