import { useEffect, useRef, useState } from 'react'
import { fetchPoiCardDetailCached, fetchPoiDetailCached, primeOperationInfo } from './api/details'
import { fetchOldTownFestivalsCached, todayYyyymmdd } from './api/festivals'
import { fetchAllOldTownPois } from './api/tourapi'
import { CURATED_CONTENT_IDS, recommendFromSpin } from './engine/spinRecommend'
import { buildCourseFromAnchor, buildCourseFromSpin, type ReadyCourse } from './engine/spinCourse'
import { DEPARTURES, DIAL_DEFAULT_MINUTES, directionOf, type Departure, type Poi, type Recommendation } from './mock/pois'
import { IntroScreen } from './screens/IntroScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { HomeScreen } from './screens/HomeScreen'
import { SpotsScreen } from './screens/SpotsScreen'
import { SpinScreen, type SpinPurpose } from './screens/SpinScreen'
import { StampScreen } from './screens/StampScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DepartureScreen } from './screens/DepartureScreen'
import { OriginPickScreen } from './screens/OriginPickScreen'
import { RevealScreen } from './screens/RevealScreen'
import { ResultScreen } from './screens/ResultScreen'
import { CourseScreen } from './screens/CourseScreen'
import { ShareScreen } from './screens/ShareScreen'
import { ThemeDeckScreen } from './screens/ThemeDeckScreen'
import { FestivalScreen } from './screens/FestivalScreen'
import type { NavTab } from './components/BottomNav'
import {
  themeInfo,
  themeJourneyTarget,
  type ThemeId,
  type ThemeJourney,
} from './engine/themes'
import { HomeGuide } from './components/HomeGuide'
import { ExitNotice } from './components/ExitNotice'
import { transitionFor, type Screen, type TransitionIntent } from './navigationMotion'
import { backActionFor } from './navigation/backAction'
import { runTopBackGuard } from './navigation/backGuards'
import { decideExit, EXIT_CONFIRM_WINDOW_MS } from './navigation/exitIntent'
import { exitApp, useHardwareBack } from './navigation/useHardwareBack'
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
  // 현장 모드에서 스핀 화면이 올려준 현재 위치 출발점 — 메모리에만 두고 네트워크로 보내지 않는다.
  const [fieldOrigin, setFieldOrigin] = useState<Departure | null>(null)
  // 이동시간 예산(분) — 20분~하루(Infinity)를 눈금으로 조정 (mock/pois DIAL_STEPS)
  const [dial, setDial] = useState<number>(DIAL_DEFAULT_MINUTES)
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [departureReturn, setDepartureReturn] = useState<Screen>('home')
  const [themeSeed, setThemeSeed] = useState<ThemeId>('sea')
  const [themeJourney, setThemeJourney] = useState<ThemeJourney | null>(null)
  const [themeReturn, setThemeReturn] = useState<Screen>('home')
  const [poiReturn, setPoiReturn] = useState<Screen>('home')
  const [course, setCourse] = useState<ReadyCourse | null>(null)
  const [courseReturn, setCourseReturn] = useState<Screen>('result')
  const [spinPurpose, setSpinPurpose] = useState<SpinPurpose>('single')
  const [spinPurposeNotice, setSpinPurposeNotice] = useState<string | null>(null)
  const [courseFailureNotice, setCourseFailureNotice] = useState<string | null>(null)
  const [homeGuideOpen, setHomeGuideOpen] = useState(false)
  const [transitionIntent, setTransitionIntent] = useState<TransitionIntent>('tab')

  // 홈에서 뒤로가기를 한 번 눌렀을 때의 종료 안내 (안드로이드 앱 전용).
  const [exitNotice, setExitNotice] = useState(false)
  const exitArmedUntil = useRef<number | null>(null)

  const disarmExit = () => {
    exitArmedUntil.current = null
    setExitNotice(false)
  }

  const goTo = (next: Screen) => {
    // 하드웨어·탭·화면 버튼 어느 쪽으로 움직이든 종료 안내는 걷는다.
    disarmExit()
    if (next === screen) return
    const intent = transitionFor(screen, next)
    runViewTransition(intent, () => {
      setTransitionIntent(intent)
      setScreen(next)
    })
  }

  // 안내 자동 숨김 — 결과 카드의 도장 토스트와 같은 패턴.
  useEffect(() => {
    if (!exitNotice) return
    const timer = window.setTimeout(() => {
      exitArmedUntil.current = null
      setExitNotice(false)
    }, EXIT_CONFIRM_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [exitNotice])

  /**
   * 안드로이드 하드웨어 뒤로가기. ① 열린 오버레이 → ② 화면 스택 → ③ 홈에서 두 번 눌러 종료.
   * 웹에서는 이 핸들러가 호출되지 않는다 (useHardwareBack이 네이티브에서만 리스너를 단다).
   */
  const handleHardwareBack = () => {
    if (booting) return // 인트로 중에는 안내가 보이지 않으므로 삼킨다
    if (runTopBackGuard()) return
    const action = backActionFor({ screen, departureReturn, poiReturn, courseReturn, themeReturn })
    if (action.kind === 'goTo') {
      goTo(action.screen)
      return
    }
    const decision = decideExit(Date.now(), exitArmedUntil.current)
    if (decision.kind === 'exit') {
      exitArmedUntil.current = null
      void exitApp()
      return
    }
    exitArmedUntil.current = decision.armedUntil
    setExitNotice(true)
  }
  useHardwareBack(handleHardwareBack)

  // SPEC 6: 세션 시작 시 4개 구 areaBasedList2를 실시간 호출(메모리/세션 캐시만, 영속 저장 없음)
  // — 운영계정 호출 이력을 자연스럽게 축적한다. 실패해도 앱 동작에는 영향 없음(추천은 큐레이션 풀 기반).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchAllOldTownPois()
        .then((regions) => {
          const total = regions.reduce((sum, r) => sum + r.pois.length, 0)
          console.info(`[Spindle] 세션 시작 POI 실시간 로드: ${total}곳 (${regions.length}개 구)`)
          // 목록 호출이 contentTypeId를 알려준 뒤에야 detailIntro2를 1회/POI로 부를 수 있다.
          // 운영 상태 축(SPEC 4장)이 첫 스핀부터 실제 이용시간·휴무를 반영하도록 배경에서 예열한다.
          // 실패해도 추천은 보수적 통과로 그대로 동작한다.
          void primeOperationInfo(CURATED_CONTENT_IDS).catch(() => {})
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

  // 현장 모드면 실제 현재 위치가, 여행 모드면 선택한 프리셋이 추천·코스의 출발점이다.
  const origin = fieldOrigin ?? departure

  const handleSpun = (headingDeg: number) => {
    const nextRec = recommendFromSpin({
      heading: headingDeg,
      departure: origin,
      budgetMinutes: dial,
      prevContentId: rec?.candidates[0]?.contentId,
      themeJourney: spinPurpose === 'single' ? themeJourney ?? undefined : undefined,
    })
    setRec(nextRec)
    setCandidateIndex(0)
    setPoiReturn('home')
    // 축제 목록은 방위와 무관하고 날짜로 세션 캐싱되므로 지금 데워둔다 — 결과 카드가
    // 마운트 900ms 뒤 조회할 때 캐시에 이미 있어, 축제 카드가 네트워크 지연만큼 늦게
    // 튀어나오지 않고 연출 타이밍대로 뜬다. 호출 수는 그대로(세션 캐시 디듀프).
    void fetchOldTownFestivalsCached(todayYyyymmdd()).catch(() => {})
    const firstContentId = nextRec.candidates[0]?.contentId
    if (firstContentId) {
      // 리빌 연출(~700ms) 동안 결과 카드가 마운트 시 다시 호출할 상세 3종을 미리 데운다.
      // 호출 수는 그대로(세션 캐시 디듀프) — 시작만 앞당겨 카드·방문정보 스켈레톤을 줄인다.
      void fetchPoiDetailCached(firstContentId).catch(() => {})
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
    if (spinPurpose === 'course') {
      const anchor = nextRec.candidates[0]
      const result = anchor ? buildCourseFromSpin({
        departure: origin,
        budgetMinutes: dial,
        anchor,
        headingDeg,
        noteReason: nextRec.expandReason,
      }) : null
      if (result?.status === 'ready') {
        setCourse(result)
        setCourseReturn('spin')
        setCourseFailureNotice(null)
        goTo('course')
      } else {
        setPoiReturn('spin')
        setCourseFailureNotice(`이 방향은 코스로 잇기 어려워요. ${result?.reason ?? '코스 다시 돌리기를 눌러 주세요.'}`)
        goTo('result')
      }
      return
    }
    setCourseFailureNotice(null)
    goTo('reveal')
  }

  /** 명소 탭·홈 추천 카드·테마 덱에서 특정 POI를 바로 열 때 — 결과 카드 재사용 */
  const openPoi = (poi: Poi, from: Screen = 'home') => {
    const direction = directionOf(poi.direction)
    setRec({ direction, candidates: [poi] })
    setCandidateIndex(0)
    setPoiReturn(from)
    setCourseFailureNotice(null)
    // 화면 전환과 겹쳐 상세를 미리 데운다 — 결과 카드가 즉시 이미지·방문정보를 채운다.
    void fetchPoiDetailCached(poi.contentId).catch(() => {})
    void fetchPoiCardDetailCached(poi.contentId).catch(() => {})
    void fetchOldTownFestivalsCached(todayYyyymmdd()).catch(() => {})
    goTo('result')
  }

  const openTheme = (themeId: ThemeId, from: Screen = 'home') => {
    setThemeSeed(themeId)
    setThemeReturn(from)
    goTo('theme')
  }

  const startThemeJourney = (themeId: ThemeId) => {
    setThemeSeed(themeId)
    setThemeJourney({ themeId, step: 1, target: themeJourneyTarget(dial) })
    setCandidateIndex(0)
    setSpinPurpose('single')
    setSpinPurposeNotice(null)
    goTo('spin')
  }

  const changeDial = (nextDial: number) => {
    setDial(nextDial)
    setThemeJourney((journey) => {
      if (!journey) return journey
      const target = themeJourneyTarget(nextDial)
      return { ...journey, step: Math.min(journey.step, target), target }
    })
  }

  const continueThemeJourney = () => {
    setThemeJourney((journey) => journey
      ? { ...journey, step: Math.min(journey.target, journey.step + 1) }
      : journey)
    setCandidateIndex(0)
    goTo('spin')
  }

  const finishThemeJourney = () => {
    const completedTheme = themeJourney?.themeId ?? rec?.theme?.id ?? themeSeed
    setThemeSeed(completedTheme)
    setThemeJourney(null)
    setThemeReturn('home')
    goTo('theme')
  }

  /**
   * 이 방향으로 코스 짜기 — 현재 보고 있는 장소를 첫 장소로 2~4곳 코스를 구성한다.
   * 코스가 만들어지면 코스 화면으로 이동하고 null을, 장소가 부족하면 사유 문자열을 반환해
   * 결과 카드가 단일 추천을 유지한 채 사유만 표시하게 한다 (docs/course.md §4).
   */
  const openCourse = (anchor: Poi): string | null => {
    const result = buildCourseFromAnchor({ departure: origin, budgetMinutes: dial, anchor, noteReason: rec?.expandReason })
    if (result.status === 'ready') {
      setCourse(result)
      setCourseReturn('result')
      goTo('course')
      return null
    }
    return result.reason
  }

  const changeSpinPurpose = (purpose: SpinPurpose) => {
    setSpinPurpose(purpose)
    setCourseFailureNotice(null)
    if (purpose === 'course' && themeJourney) {
      setThemeJourney(null)
      setSpinPurposeNotice('코스 모드에서는 테마 여정을 잠시 마쳐요.')
    } else {
      setSpinPurposeNotice(null)
    }
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
      return (
        <SpinScreen
          departure={departure}
          dial={dial}
          onDialChange={changeDial}
          onOpenDeparture={() => openDeparture('spin')}
          onSpun={handleSpun}
          onNavigate={navigate}
          theme={themeJourney ? themeInfo(themeJourney.themeId) : undefined}
          themeStep={themeJourney?.step}
          themeTarget={themeJourney?.target}
          onOpenTheme={() => openTheme(themeJourney?.themeId ?? themeSeed, 'spin')}
          onClearTheme={() => setThemeJourney(null)}
          purpose={spinPurpose}
          onPurposeChange={changeSpinPurpose}
          purposeNotice={spinPurposeNotice}
          onFieldOriginChange={setFieldOrigin}
        />
      )
    case 'stamp':
      return <StampScreen onNavigate={navigate} />
    case 'settings':
      return (
        <SettingsScreen
          departure={departure}
          dial={dial}
          onDialChange={changeDial}
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
          onOpenMap={() => goTo('origin-pick')}
          onBack={() => goTo(departureReturn)}
        />
      )
    case 'origin-pick':
      return (
        <OriginPickScreen
          origin={departure}
          onConfirm={(d) => {
            setDeparture(d)
            goTo(departureReturn)
          }}
          onBack={() => goTo('departure')}
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
          onContinueTheme={continueThemeJourney}
          onFinishTheme={finishThemeJourney}
          initialCourseNotice={courseFailureNotice}
        />
      ) : null
    case 'course':
      return course ? (
        <CourseScreen
          course={course}
          departure={origin}
          onBack={() => goTo(courseReturn)}
          onRespin={() => {
            setSpinPurpose(courseReturn === 'spin' ? 'course' : 'single')
            goTo('spin')
          }}
        />
      ) : null
    case 'share':
      return rec ? <ShareScreen rec={rec} poi={rec.candidates[candidateIndex]} onBack={() => goTo('result')} /> : null
    case 'theme':
      return (
        <ThemeDeckScreen
          initialTheme={themeSeed}
          journeyTarget={themeJourneyTarget(dial)}
          onStart={startThemeJourney}
          onSelect={(poi) => {
            setThemeJourney(null)
            openPoi(poi, 'theme')
          }}
          onNavigate={navigate}
          onBack={() => goTo(themeReturn)}
        />
      )
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
    <>
      <div className="screen-transition" data-transition={transitionIntent} key={screen}>
        {view}
      </div>
      {/* 화면 전환 래퍼 바깥 — key={screen} 리마운트에 휩쓸리지 않게 한다 */}
      {exitNotice && <ExitNotice />}
    </>
  )
}

export default App
