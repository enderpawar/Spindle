import type { KeyboardEvent } from 'react'
import { DIAL_STEPS, dialDesc, dialMoodLabel, dialTimeLabel } from '../mock/pois'

interface Props {
  /** 현재 이동시간 예산(분). Infinity = 하루 */
  minutes: number
  onChange: (minutes: number) => void
}

/*
 * 다이얼은 눈금 스냅 없이 1분 단위로 부드럽게 움직인다.
 * 트랙 좌표(raw 0..RAW_MAX)는 앵커 눈금(DIAL_STEPS) 사이를 구간별 선형 보간해
 * 분으로 변환한다 — 자주 쓰는 짧은 예산(20~90분)이 트랙의 절반을 차지하는
 * 지각적 배치를 유지하면서 값은 연속으로 조정된다.
 */
const RAW_MAX = 1000
const SEGMENTS = DIAL_STEPS.length - 1
const SEG = RAW_MAX / SEGMENTS
/** 마지막 구간(4시간→하루)의 가상 끝값 — 이 값을 넘으면 하루(무제한)로 본다 */
const DAY_THRESHOLD_MIN = 480
const LAST_ANCHOR_VIRTUAL = 490

const anchorMinutes = (i: number): number => (i >= SEGMENTS ? LAST_ANCHOR_VIRTUAL : DIAL_STEPS[i])

/** 트랙 좌표 → 분 (1분 반올림). 끝 = 하루(∞), 8시간 초과도 하루로 스냅 */
export function rawToMinutes(raw: number): number {
  const r = Math.min(Math.max(raw, 0), RAW_MAX)
  if (r >= RAW_MAX) return Infinity
  const seg = Math.min(Math.floor(r / SEG), SEGMENTS - 1)
  const t = (r - seg * SEG) / SEG
  const m = Math.round(anchorMinutes(seg) + t * (anchorMinutes(seg + 1) - anchorMinutes(seg)))
  return m > DAY_THRESHOLD_MIN ? Infinity : m
}

/** 분 → 트랙 좌표 (rawToMinutes의 역함수) */
export function minutesToRaw(minutes: number): number {
  if (!Number.isFinite(minutes)) return RAW_MAX
  const m = Math.min(Math.max(minutes, DIAL_STEPS[0]), LAST_ANCHOR_VIRTUAL)
  let seg = SEGMENTS - 1
  for (let i = 0; i < SEGMENTS; i += 1) {
    if (m <= anchorMinutes(i + 1)) {
      seg = i
      break
    }
  }
  const t = (m - anchorMinutes(seg)) / (anchorMinutes(seg + 1) - anchorMinutes(seg))
  return (seg + t) * SEG
}

/** 하단 라벨 앵커 — 눈금 0 / 중앙 / 끝 지점의 실제 값 표기 */
const ANCHOR_LABELS = [
  dialTimeLabel(DIAL_STEPS[0]),
  dialTimeLabel(DIAL_STEPS[(DIAL_STEPS.length - 1) / 2]),
  dialTimeLabel(DIAL_STEPS[DIAL_STEPS.length - 1]),
]

/** 이동시간 다이얼 — 20분~하루를 1분 단위로 부드럽게 조정하는 슬라이더 (스핀·설정 공용) */
export function DialSlider({ minutes, onChange }: Props) {
  const raw = Math.round(minutesToRaw(minutes))
  const anchor = Math.round((raw / RAW_MAX) * (ANCHOR_LABELS.length - 1))

  /** 키보드 미세 조정 — 화살표 ±1분, PageUp/Down ±30분 (raw 좌표는 1분 미만이라 직접 처리) */
  const nudge = (deltaMin: number) => {
    const base = Number.isFinite(minutes) ? minutes : DAY_THRESHOLD_MIN + 1
    const next = base + deltaMin
    onChange(next > DAY_THRESHOLD_MIN ? Infinity : Math.max(DIAL_STEPS[0], next))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : event.key === 'PageUp'
            ? 30
            : event.key === 'PageDown'
              ? -30
              : null
    if (delta !== null) {
      event.preventDefault()
      nudge(delta)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(DIAL_STEPS[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(Infinity)
    }
  }

  return (
    <div className="dial-slider">
      <div className="dial-slider-summary" aria-hidden>
        <span>{dialMoodLabel(minutes)}</span>
        <span>{dialDesc(minutes)}</span>
      </div>
      <div className="dial-slider-control">
        <div className="dial-slider-track" aria-hidden>
          <span className="dial-slider-fill" style={{ width: `${(raw / RAW_MAX) * 100}%` }} />
          {DIAL_STEPS.map((m, i) => (
            <span
              key={m}
              className={`dial-slider-mark${i * SEG <= raw ? ' is-active' : ''}`}
              style={{ left: `${(i / SEGMENTS) * 100}%` }}
            />
          ))}
        </div>
        <input
          className="dial-slider-input"
          type="range"
          min={0}
          max={RAW_MAX}
          step={1}
          value={raw}
          aria-label="이동시간 범위"
          aria-valuetext={`${dialTimeLabel(minutes)}, ${dialDesc(minutes)}`}
          onChange={(event) => onChange(rawToMinutes(Number(event.currentTarget.value)))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="dial-slider-labels" aria-hidden>
        {ANCHOR_LABELS.map((label, i) => (
          <span key={label} className={i === anchor ? 'is-active' : ''}>{label}</span>
        ))}
      </div>
    </div>
  )
}
