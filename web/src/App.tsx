import { useState } from 'react'
import { DEPARTURES, recommend, type Departure, type DialId, type Recommendation } from './mock/pois'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { DepartureScreen } from './screens/DepartureScreen'
import { RevealScreen } from './screens/RevealScreen'
import { ResultScreen } from './screens/ResultScreen'
import { ShareScreen } from './screens/ShareScreen'

// ui.md 화면 흐름: S0 온보딩 → S1 홈/스핀 ⇄ S2 출발점 → S3 방위 연출 → S4 결과 → S5 공유
export type Screen = 'onboarding' | 'home' | 'departure' | 'reveal' | 'result' | 'share'

const ONBOARD_KEY = 'spindle.onboarded' // 온보딩 노출 여부만 저장 (API 데이터 아님 — 규정 무관)

function App() {
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem(ONBOARD_KEY) ? 'home' : 'onboarding'))
  const [departure, setDeparture] = useState<Departure>(DEPARTURES[0])
  const [dial, setDial] = useState<DialId>('half')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARD_KEY, '1')
    setScreen('home')
  }

  const handleSpun = (headingDeg: number) => {
    setRec(recommend(headingDeg))
    setCandidateIndex(0)
    setScreen('reveal')
  }

  switch (screen) {
    case 'onboarding':
      return <OnboardingScreen onDone={finishOnboarding} />
    case 'departure':
      return (
        <DepartureScreen
          selected={departure}
          onSelect={(d) => {
            setDeparture(d)
            setScreen('home')
          }}
          onBack={() => setScreen('home')}
        />
      )
    case 'reveal':
      return rec ? <RevealScreen rec={rec} onOpen={() => setScreen('result')} /> : null
    case 'result':
      return rec ? (
        <ResultScreen
          rec={rec}
          candidateIndex={candidateIndex}
          onNextCandidate={() => setCandidateIndex((i) => (i + 1) % rec.candidates.length)}
          onRespin={() => setScreen('home')}
          onShare={() => setScreen('share')}
        />
      ) : null
    case 'share':
      return rec ? <ShareScreen rec={rec} poi={rec.candidates[candidateIndex]} onBack={() => setScreen('result')} /> : null
    default:
      return (
        <HomeScreen
          departure={departure}
          dial={dial}
          onDialChange={setDial}
          onOpenDeparture={() => setScreen('departure')}
          onSpun={handleSpun}
        />
      )
  }
}

export default App
