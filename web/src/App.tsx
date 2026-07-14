import { useEffect, useState } from 'react'
import { fetchPoiCardDetailCached } from './api/details'
import { fetchAllOldTownPois } from './api/tourapi'
import { recommendFromSpin } from './engine/spinRecommend'
import { buildCourseFromAnchor, type ReadyCourse } from './engine/spinCourse'
import { DEPARTURES, DIRECTIONS, type Departure, type DialId, type Poi, type Recommendation } from './mock/pois'
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

// 탭(홈·명소·스핀·도장·설정)은 라이트 테마, 스핀 의식(스핀→리빌→공유)은 밤바다 몰입 테마.
export type Screen = 'onboarding' | 'home' | 'spots' | 'spin' | 'stamp' | 'settings' | 'departure' | 'reveal' | 'result' | 'course' | 'share' | 'theme' | 'festival'

const ONBOARD_KEY = 'spindle.onboarded' // 온보딩 노출 여부만 저장 (API 데이터 아님 — 규정 무관)

// 화면 전환 연출 구분: 탭·첫 진입은 부드러운 페이드, 그 외(드릴다운·스핀 의식)는 오른쪽 슬라이드-인.
const FADE_SCREENS = new Set<Screen>(['onboarding', 'home', 'spots', 'spin', 'stamp', 'settings'])

function App() {
  // 콜드 스타트 인트로 스플래시 — 앱 부팅마다 한 번 노출(세션 시작 POI 프리페치를 자연스럽게 가린다)
  const [booting, setBooting] = useState(true)
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem(ONBOARD_KEY) ? 'home' : 'onboarding'))
  const [departure, setDeparture] = useState<Departure>(DEPARTURES[0])
  const [dial, setDial] = useState<DialId>('half')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [departureReturn, setDepartureReturn] = useState<Screen>('home')
  const [themeSeed, setThemeSeed] = useState<ThemeId>('sea')
  const [poiReturn, setPoiReturn] = useState<Screen>('home')
  const [course, setCourse] = useState<ReadyCourse | null>(null)

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
    setScreen('home')
  }

  const handleSpun = (headingDeg: number) => {
    const nextRec = recommendFromSpin({
      heading: headingDeg,
      departure,
      dial,
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
    setScreen('reveal')
  }

  /** 명소 탭·홈 추천 카드·테마 덱에서 특정 POI를 바로 열 때 — 결과 카드 재사용 */
  const openPoi = (poi: Poi, from: Screen = 'home') => {
    const direction = DIRECTIONS.find((d) => d.id === poi.direction) ?? DIRECTIONS[0]
    setRec({ direction, candidates: [poi] })
    setCandidateIndex(0)
    setPoiReturn(from)
    void fetchPoiCardDetailCached(poi.contentId).catch(() => {})
    setScreen('result')
  }

  const openTheme = (themeId: ThemeId) => {
    setThemeSeed(themeId)
    setScreen('theme')
  }

  /**
   * 이 방향으로 코스 짜기 — 현재 보고 있는 장소를 첫 장소로 2~4곳 코스를 구성한다.
   * 코스가 만들어지면 코스 화면으로 이동하고 null을, 장소가 부족하면 사유 문자열을 반환해
   * 결과 카드가 단일 추천을 유지한 채 사유만 표시하게 한다 (docs/course.md §4).
   */
  const openCourse = (anchor: Poi): string | null => {
    const result = buildCourseFromAnchor({ departure, dial, anchor, noteReason: rec?.expandReason })
    if (result.status === 'ready') {
      setCourse(result)
      setScreen('course')
      return null
    }
    return result.reason
  }

  const openDeparture = (from: Screen) => {
    setDepartureReturn(from)
    setScreen('departure')
  }

  const navigate = (tab: NavTab) => setScreen(tab)

  if (booting) {
    return <IntroScreen onDone={() => setBooting(false)} />
  }

  // 화면별 렌더 요소를 뽑아, key가 있는 전환 래퍼로 감싼다 (내비게이션마다 진입 애니메이션 재생).
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
          onBuildCourse={openCourse}
        />
      ) : null
    case 'course':
      return course ? (
        <CourseScreen
          course={course}
          departure={departure}
          onBack={() => setScreen('result')}
          onRespin={() => setScreen('spin')}
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
  })()

  return (
    <div className="screen-anim" data-transition={FADE_SCREENS.has(screen) ? 'fade' : 'push'} key={screen}>
      {view}
    </div>
  )
}

export default App
