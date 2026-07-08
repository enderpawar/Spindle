import { useState } from 'react'
import { DEPARTURES, DIRECTIONS, recommend, type Departure, type DialId, type Poi, type Recommendation } from './mock/pois'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { SpotsScreen } from './screens/SpotsScreen'
import { SpinScreen } from './screens/SpinScreen'
import { StampScreen } from './screens/StampScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DepartureScreen } from './screens/DepartureScreen'
import { RevealScreen } from './screens/RevealScreen'
import { ResultScreen } from './screens/ResultScreen'
import { ShareScreen } from './screens/ShareScreen'
import { ThemeDeckScreen } from './screens/ThemeDeckScreen'
import { FestivalScreen } from './screens/FestivalScreen'
import type { NavTab } from './components/BottomNav'
import type { ThemeId } from './engine/themes'

// 탭(홈·명소·스핀·도장·설정)은 라이트 테마, 스핀 의식(스핀→리빌→공유)은 밤바다 몰입 테마.
export type Screen = 'onboarding' | 'home' | 'spots' | 'spin' | 'stamp' | 'settings' | 'departure' | 'reveal' | 'result' | 'share' | 'theme' | 'festival'

const ONBOARD_KEY = 'spindle.onboarded' // 온보딩 노출 여부만 저장 (API 데이터 아님 — 규정 무관)

function App() {
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem(ONBOARD_KEY) ? 'home' : 'onboarding'))
  const [departure, setDeparture] = useState<Departure>(DEPARTURES[0])
  const [dial, setDial] = useState<DialId>('half')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [departureReturn, setDepartureReturn] = useState<Screen>('home')
  const [themeSeed, setThemeSeed] = useState<ThemeId>('sea')
  const [poiReturn, setPoiReturn] = useState<Screen>('home')

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARD_KEY, '1')
    setScreen('home')
  }

  const handleSpun = (headingDeg: number) => {
    setRec(recommend(headingDeg))
    setCandidateIndex(0)
    setPoiReturn('home')
    setScreen('reveal')
  }

  /** 명소 탭·홈 추천 카드·테마 덱에서 특정 POI를 바로 열 때 — 결과 카드 재사용 */
  const openPoi = (poi: Poi, from: Screen = 'home') => {
    const direction = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
    setRec({ direction, candidates: [poi] })
    setCandidateIndex(0)
    setPoiReturn(from)
    setScreen('result')
  }

  const openTheme = (themeId: ThemeId) => {
    setThemeSeed(themeId)
    setScreen('theme')
  }

  const openDeparture = (from: Screen) => {
    setDepartureReturn(from)
    setScreen('departure')
  }

  const navigate = (tab: NavTab) => setScreen(tab)

  switch (screen) {
    case 'onboarding':
      return <OnboardingScreen onDone={finishOnboarding} />
    case 'spots':
      return <SpotsScreen onNavigate={navigate} onSelect={openPoi} />
    case 'spin':
      return <SpinScreen departure={departure} dial={dial} onDialChange={setDial} onOpenDeparture={() => openDeparture('spin')} onSpun={handleSpun} onNavigate={navigate} />
    case 'stamp':
      return <StampScreen onNavigate={navigate} />
    case 'settings':
      return (
        <SettingsScreen
          departure={departure}
          dial={dial}
          onDialChange={setDial}
          onOpenDeparture={() => openDeparture('settings')}
          onReplayOnboarding={() => setScreen('onboarding')}
          onNavigate={navigate}
        />
      )
    case 'departure':
      return (
        <DepartureScreen
          selected={departure}
          onSelect={(d) => {
            setDeparture(d)
            setScreen(departureReturn)
          }}
          onBack={() => setScreen(departureReturn)}
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
          onBack={() => setScreen(poiReturn)}
          onRespin={() => setScreen('spin')}
          onShare={() => setScreen('share')}
        />
      ) : null
    case 'share':
      return rec ? <ShareScreen rec={rec} poi={rec.candidates[candidateIndex]} onBack={() => setScreen('result')} /> : null
    case 'theme':
      return <ThemeDeckScreen initialTheme={themeSeed} onSelect={(poi) => openPoi(poi, 'theme')} onNavigate={navigate} onBack={() => setScreen('home')} />
    case 'festival':
      return <FestivalScreen onNavigate={navigate} onBack={() => setScreen('home')} />
    default:
      return <HomeScreen departure={departure} onOpenDeparture={() => openDeparture('home')} onSelectPoi={openPoi} onOpenTheme={openTheme} onOpenFestival={() => setScreen('festival')} onNavigate={navigate} />
  }
}

export default App
