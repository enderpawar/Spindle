import { dialTimeLabel, type Departure } from '../mock/pois'

export interface HomeSpinContextProps {
  departure: Departure
  dial: number
  candidateCount: number | null
  festivalOngoingCount: number | null
  onStartSpin: (minutes?: 20 | 40) => void
  onOpenFestival: () => void
}

export function HomeSpinContext({
  departure,
  dial,
  candidateCount,
  festivalOngoingCount,
  onStartSpin,
  onOpenFestival,
}: HomeSpinContextProps) {
  const candidateCopy = candidateCount === null
    ? null
    : candidateCount > 0
      ? `현재 이동시간 안에 후보 ${candidateCount}곳이 있어요`
      : '이동시간을 넓혀 추천해요'

  return (
    <section className="home-spin-context" aria-labelledby="home-spin-context-title">
      <div className="home-spin-context-heading">
        <h2 id="home-spin-context-title">오늘의 스핀 조건</h2>
        <p>{departure.name} 출발 · 이동 {dialTimeLabel(dial)}</p>
      </div>

      {candidateCopy && <p className="home-spin-candidate" aria-live="polite">{candidateCopy}</p>}

      {festivalOngoingCount !== null && festivalOngoingCount > 0 && (
        <button type="button" className="home-spin-festival" onClick={onOpenFestival}>
          <span>지금 원도심·영도에서 축제 {festivalOngoingCount}건이 열리고 있어요</span>
          <span aria-hidden>›</span>
        </button>
      )}

      <button type="button" className="home-spin-submit btn" onClick={() => onStartSpin()}>
        이 조건으로 돌리기
      </button>

      <div className="home-spin-quick" aria-label="이동시간 바로 선택">
        <button type="button" aria-label="20분으로 스핀 준비" onClick={() => onStartSpin(20)}>
          20분
        </button>
        <button type="button" aria-label="40분으로 스핀 준비" onClick={() => onStartSpin(40)}>
          40분
        </button>
      </div>
    </section>
  )
}
