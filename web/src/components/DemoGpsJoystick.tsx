import { useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  onStep: (eastMeters: number, northMeters: number, headingDeg: number) => void
}

const MAX_KNOB_PX = 34
const DEMO_SPEED_MPS = 52

export function DemoGpsJoystick({ onStep }: Props) {
  const padRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLSpanElement>(null)
  const vectorRef = useRef({ x: 0, y: 0 })
  const callbackRef = useRef(onStep)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  callbackRef.current = onStep

  const paintKnob = (x: number, y: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate3d(${x * MAX_KNOB_PX}px, ${y * MAX_KNOB_PX}px, 0)`
  }

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const rawX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const rawY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    const length = Math.hypot(rawX, rawY)
    const scale = length > 1 ? 1 / length : 1
    const vector = { x: rawX * scale, y: rawY * scale }
    vectorRef.current = vector
    paintKnob(vector.x, vector.y)
  }

  const stop = () => {
    vectorRef.current = { x: 0, y: 0 }
    lastTimeRef.current = 0
    paintKnob(0, 0)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
  }

  const run = (now: number) => {
    const vector = vectorRef.current
    if (!lastTimeRef.current) lastTimeRef.current = now
    const seconds = Math.min((now - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = now
    if (Math.hypot(vector.x, vector.y) > 0.08) {
      const east = vector.x * DEMO_SPEED_MPS * seconds
      const north = -vector.y * DEMO_SPEED_MPS * seconds
      const heading = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360
      callbackRef.current(east, north, heading)
    }
    frameRef.current = requestAnimationFrame(run)
  }

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event)
    if (!frameRef.current) frameRef.current = requestAnimationFrame(run)
  }

  const keyboardStep = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, [number, number, number]> = {
      ArrowUp: [0, 18, 0],
      ArrowRight: [18, 0, 90],
      ArrowDown: [0, -18, 180],
      ArrowLeft: [-18, 0, 270],
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    callbackRef.current(...step)
  }

  useEffect(() => () => stop(), [])

  return (
    <div className="demo-gps-control">
      <strong>GPS 조이스틱</strong>
      <span>목적지 쪽으로 밀어보세요</span>
      <div
        ref={padRef}
        className="demo-gps-joystick"
        role="application"
        tabIndex={0}
        aria-label="가상 GPS 이동 조이스틱. 방향키로도 움직일 수 있습니다."
        onPointerDown={start}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event)
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={keyboardStep}
      >
        <span className="demo-gps-joystick__axis" aria-hidden />
        <span ref={knobRef} className="demo-gps-joystick__knob" aria-hidden />
      </div>
    </div>
  )
}
