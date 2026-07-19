import { useEffect, useState } from 'react'
import { fetchPoiCardDetailCached } from './api/details'
import { fetchAllOldTownPois } from './api/tourapi'
import { recommendFromSpin } from './engine/spinRecommend'
import { buildCourseFromAnchor, type ReadyCourse } from './engine/spinCourse'
import { DEPARTURES, DIAL_DEFAULT_MINUTES, DIRECTIONS, type Departure, type Poi, type Recommendation } from './mock/pois'
import { IntroScreen } from './screens/IntroScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { SpotsScreen } from './screens/SpotsScreen'
import { SpinScreen } from './screens/SpinScreen'
import { StampScreen } from './screens/StampScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DepartureScreen } from './screens/DepartureScreen'
import { RevealScreen } from './screens/RevealScreen'
import { ResultScreen } from './screens/ResultScreen'
import { CourseScreen } from './screens/CourseScreen'
import { ShareScreen } from './screens/ShareScreen'
import { ThemeDeckScreen } from './screens/ThemeDeckScreen'
import { FestivalScreen } from './screens/FestivalScreen'
import type { NavTab } from './components/BottomNav'
import type { ThemeId } from './engine/themes'
import { HomeGuide } from './components/HomeGuide'
import { transitionFor, type Screen, type TransitionIntent } from './navigationMotion'
import { runViewTransition } from './viewTransition'
import { usePressFeedback } from './usePressFeedback'

// 탭(홈·명소·스핀·도장·설정)은 라이트 테마, 스핀 의식(스핀→리빌→공유)은 밤바다 몰입 테마.

const ONBOARD_KEY = 'spindle.onboarded' // 온보딩 노출 여부만 저장 (API 데이터 아님 — 규정 무관)

function App() {
  usePressFeedback()

  // 콜드 스타트 인트로 스플래시 — 앱 부팅마다 한 번 노출(세션 시작 POI 프리페치를 자연스럽게 가린다)
  const [booting, setBooting] = useState(true)
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem(ONBOARD_KEY) ? 'home' : 'onboarding'))
  const [departure, setDeparture] = useState<Departure>(DEPARTURES[0])
  // 이동시간 예산(분) — 20분~하루(Infinity)를 눈금으로 조정 (mock/pois DIAL_STEPS)
  const [dial, setDial] = useState<number>(DIAL_DEFAULT_MINUTES)
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [departureReturn, setDepartureReturn] = useState<Screen>('home')
  const [themeSeed, setThemeSeed] = useState<ThemeId>('sea')
  const [poiReturn, setPoiReturn] = useState<Screen>('home')
  const [course, setCourse] = useState<ReadyCourse | null>(null)
  const [homeGuideOpen, setHomeGuideOpen] = useState(false)
  const [transitionIntent, setTransitionIntent] = useState<TransitionIntent>('tab')

  const goTo = (next: Screen) => {
    if (next === screen) return
    const intent = transitionFor(screen, next)
    runViewTransition(intent, () => {
      setTransitionIntent(intent)
      setScreen(next)
    })
  }

  // SPEC 6: 세션 시작 시 4개 구 areaBasedList2를 실시간 호출(메모리/세션 캐시만, 영속 저장 없음)
  // — 운영계정 호출 이력을 자연스럽게 축적한다. 실패해도 앱 동작에는 영향 없음(추천은 큐레이션 풀 기반).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchAllOldTownPois()
        .then((regions) => {
          const total = regions.reduce((sum, r) => sum + r.pois.length, 0)
          console.info(`[Spindle] 세션 시작 POI 실시간 로드: ${total}곳 (${regions.length}개 구)`)
        })
        .catch(() => {
          /* 목록 로드 실패는 추천에 영향 없음 — 결과 시점 상세 호출에서 별도 에러 UI 처리 */
        })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [])

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARD_KEY, '1')
    goTo('home')
  }

  const handleSpun = (headingDeg: number) => {
    const nextRec = recommendFromSpin({
      heading: headingDeg,
      departure,
      budgetMinutes: dial,
      prevContentId: rec?.candidates[0]?.contentId,
    })
    setRec(nextRec)
    setCandidateIndex(0)
    setPoiReturn('home')
    const firstContentId = nextRec.candidates[0]?.contentId
    if (firstContentId) {
      void fetchPoiCardDetailCached(firstContentId)
        .catch(() => {})
        .finally(() => {
          window.setTimeout(() => {
            for (const candidate of nextRec.candidates.slice(1)) {
              void fetchPoiCardDetailCached(candidate.contentId).catch(() => {})
            }
          }, 500)
        })
    }
    goTo('reveal')
  }

  /** 명소 탭·홈 추천 카드·테마 덱에서 특정 POI를 바로 열 때 — 결과 카드 재사용 */
  const openPoi = (poi: Poi, from: Screen = 'home') => {
    const direction = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
    setRec({ direction, candidates: [poi] })
    setCandidateIndex(0)
    setPoiReturn(from)
    void fetchPoiCardDetailCached(poi.contentId).catch(() => {})
    goTo('result')
  }

  const openTheme = (themeId: ThemeId) => {
    setThemeSeed(themeId)
    goTo('theme')
  }

  /**
   * 이 방향으로 코스 짜기 — 현재 보고 있는 장소를 첫 장소로 2~4곳 코스를 구성한다.
   * 코스가 만들어지면 코스 화면으로 이동하고 null을, 장소가 부족하면 사유 문자열을 반환해
   * 결과 카드가 단일 추천을 유지한 채 사유만 표시하게 한다 (docs/course.md §4).
   */
  const openCourse = (anchor: Poi): string | null => {
    const result = buildCourseFromAnchor({ departure, budgetMinutes: dial, anchor, noteReason: rec?.expandReason })
    if (result.status === 'ready') {
      setCourse(result)
      goTo('course')
      return null
    }
    return result.reason
  }

  const openDeparture = (from: Screen) => {
    setDepartureReturn(from)
    goTo('departure')
  }

  const navigate = (tab: NavTab) => goTo(tab)

  if (booting) {
    return <IntroScreen onDone={() => setBooting(false)} />
  }

  const view = (() => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen onDone={finishOnboarding} />
    case 'spots':
      return <SpotsScreen departure={departure} onNavigate={navigate} onSelect={openPoi} />
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
          onReplayGuide={() => {
            setHomeGuideOpen(true)
            goTo('home')
          }}
          onNavigate={navigate}
        />
      )
    case 'departure':
      return (
        <DepartureScreen
          selected={departure}
          onSelect={(d) => {
            setDeparture(d)
            goTo(departureReturn)
          }}
          onBack={() => goTo(departureReturn)}
        />
      )
    case 'reveal':
      return rec ? <RevealScreen rec={rec} onOpen={() => goTo('result')} /> : null
    case 'result':
      return rec ? (
        <ResultScreen
          rec={rec}
          candidateIndex={candidateIndex}
          onNextCandidate={() => setCandidateIndex((i) => (i + 1) % rec.candidates.length)}
          onBack={() => goTo(poiReturn)}
          onRespin={() => goTo('spin')}
          onShare={() => goTo('share')}
          onBuildCourse={openCourse}
        />
      ) : null
    case 'course':
      return course ? (
        <CourseScreen
          course={course}
          departure={departure}
          onBack={() => goTo('result')}
          onRespin={() => goTo('spin')}
        />
      ) : null
    case 'share':
      return rec ? <ShareScreen rec={rec} poi={rec.candidates[candidateIndex]} onBack={() => goTo('result')} /> : null
    case 'theme':
      return <ThemeDeckScreen initialTheme={themeSeed} onSelect={(poi) => openPoi(poi, 'theme')} onNavigate={navigate} onBack={() => goTo('home')} />
    case 'festival':
      return <FestivalScreen onNavigate={navigate} onBack={() => goTo('home')} />
    default:
      return (
        <>
          <HomeScreen departure={departure} onOpenDeparture={() => openDeparture('home')} onSelectPoi={openPoi} onOpenTheme={openTheme} onOpenFestival={() => goTo('festival')} onNavigate={navigate} />
          {homeGuideOpen && <HomeGuide onClose={() => setHomeGuideOpen(false)} />}
        </>
      )
    }
  })()

  return (
    <div className="screen-transition" data-transition={transitionIntent} key={screen}>
      {view}
    </div>
  )
}

export default App
