import { DIAL_STEPS, dialDesc, dialMoodLabel, dialTimeLabel } from '../mock/pois'

interface Props {
  /** 현재 이동시간 예산(분). DIAL_STEPS의 눈금 값 (Infinity = 하루) */
  minutes: number
  onChange: (minutes: number) => void
}

/** 하단 라벨 앵커 — 눈금 0 / 중앙 / 끝 지점의 실제 값 표기 */
const ANCHOR_LABELS = [
  dialTimeLabel(DIAL_STEPS[0]),
  dialTimeLabel(DIAL_STEPS[(DIAL_STEPS.length - 1) / 2]),
  dialTimeLabel(DIAL_STEPS[DIAL_STEPS.length - 1]),
]

/** 이동시간 다이얼 — 20분~하루를 자연스러운 눈금으로 좌우 조정하는 슬라이더 (스핀·설정 공용) */
export function DialSlider({ minutes, onChange }: Props) {
  const last = DIAL_STEPS.length - 1
  const found = DIAL_STEPS.findIndex((m) => m === minutes)
  const index = found >= 0 ? found : DIAL_STEPS.findIndex((m) => minutes <= m) // 눈금 밖 값은 가까운 눈금으로
  const safeIndex = index >= 0 ? index : last
  const anchor = Math.round((safeIndex / last) * (ANCHOR_LABELS.length - 1))

  return (
    <div className="dial-slider">
      <div className="dial-slider-summary" aria-hidden>
        <span>{dialMoodLabel(minutes)}</span>
        <span>{dialDesc(minutes)}</span>
      </div>
      <div className="dial-slider-control">
        <div className="dial-slider-track" aria-hidden>
          <span className="dial-slider-fill" style={{ width: `${(safeIndex / last) * 100}%` }} />
          {DIAL_STEPS.map((m, i) => (
            <span
              key={m}
              className={`dial-slider-mark${i <= safeIndex ? ' is-active' : ''}`}
              style={{ left: `${(i / last) * 100}%` }}
            />
          ))}
        </div>
        <input
          className="dial-slider-input"
          type="range"
          min={0}
          max={last}
          step={1}
          value={safeIndex}
          aria-label="이동시간 범위"
          aria-valuetext={`${dialTimeLabel(minutes)}, ${dialDesc(minutes)}`}
          onChange={(event) => onChange(DIAL_STEPS[Number(event.currentTarget.value)])}
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
