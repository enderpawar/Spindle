import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DemoGpsJoystick } from '../components/DemoGpsJoystick'
import { PoiPhoto } from '../components/PoiPhoto'
import { advanceArrival, guidanceSnapshot, type GuidanceSnapshot, type GuidanceTurn } from '../engine/courseGuidance'
import { haversineMeters, movePointMeters, pointBeforeTarget, type GeoPoint } from '../engine/geo'
import { HeadingSmoother } from '../engine/heading'
import type { CourseStopView, ReadyCourse } from '../engine/spinCourse'
import { zoneOf } from '../engine/zones'
import { copyOf } from '../engine/curation'
import { kakaoMapDirectionsUrl } from '../lib/mapLinks'
import { markVisited } from '../lib/visited'
import { MapView } from '../map/MapView'
import type { Departure } from '../mock/pois'
import { watchCurrentFix } from '../sensors/geolocation'
import { subscribeHeading, type OrientationPermission } from '../sensors/orientation'

interface Props {
  course: ReadyCourse
  orientationPermission: OrientationPermission
  demo?: boolean
  onExit: () => void
}

type GuideStatus = 'locating' | 'guiding' | 'paused' | 'error' | 'arrived' | 'completed'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

const TURN_COPY: Record<GuidanceTurn, string> = {
  forward: '앞쪽으로 계속 이동하세요',
  right: '오른쪽 방향으로 이동하세요',
  left: '왼쪽 방향으로 이동하세요',
  behind: '뒤쪽 방향으로 돌아가세요',
}

const TURN_ROTATION: Record<GuidanceTurn, number> = {
  forward: 0,
  right: 90,
  left: -90,
  behind: 180,
}

const METHOD_COPY: Record<CourseStopView['method'], string> = {
  walk: '방향을 따라 걸어가세요',
  bridge: '다리를 건너 이동하는 구간이에요',
  transit: '대중교통으로 이동하는 구간이에요',
  estimate: '카카오맵에서 실제 경로를 확인해 주세요',
}

function distanceLabel(distanceM: number | null): string {
  if (distanceM === null) return '거리 확인 중'
  if (distanceM < 1000) return `${Math.max(0, Math.round(distanceM / 10) * 10)}m 남음`
  return `${(distanceM / 1000).toFixed(1)}km 남음`
}

function demoStart(stop: CourseStopView, courseHeading: number, index: number): { point: GeoPoint; heading: number; snapshot: GuidanceSnapshot } {
  const target = { lat: stop.poi.lat, lng: stop.poi.lon }
  const bearingToTarget = (courseHeading + index * 42) % 360
  const point = pointBeforeTarget(target, bearingToTarget, 320 + index * 80)
  const heading = (bearingToTarget + (index % 2 ? 72 : 0)) % 360
  return { point, heading, snapshot: guidanceSnapshot(point, target, heading) }
}

export function CourseGuideScreen({ course, orientationPermission, demo = false, onExit }: Props) {
  const [manualDemo, setManualDemo] = useState(false)
  const [mapProvider, setMapProvider] = useState<'loading' | 'kakao' | 'local'>('loading')
  const isDemo = demo || manualDemo
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentStop = course.stops[currentIndex]
  const initialDemo = useMemo(() => demoStart(course.stops[0], course.headingDeg, 0), [course])
  const [status, setStatus] = useState<GuideStatus>(() => demo ? 'guiding' : orientationPermission === 'granted' ? 'locating' : 'error')
  const [snapshot, setSnapshot] = useState<GuidanceSnapshot | null>(() => demo ? initialDemo.snapshot : null)
  const [accuracyM, setAccuracyM] = useState<number | null>(null)
  const [mapPosition, setMapPosition] = useState<GeoPoint | null>(() => demo ? initialDemo.point : null)
  const [currentHeading, setCurrentHeading] = useState(() => demo ? initialDemo.heading : course.headingDeg)
  const [errorCopy, setErrorCopy] = useState(() => orientationPermission === 'denied'
    ? '나침반 권한이 없어 방향 안내를 시작할 수 없어요.'
    : orientationPermission === 'unsupported'
      ? '이 기기에서는 나침반 방향을 읽을 수 없어요.'
      : '')
  const mapPositionRef = useRef<GeoPoint | null>(demo ? initialDemo.point : null)
  const demoArrivalCountRef = useRef(0)

  const targetPoint = useMemo(() => ({ lat: currentStop.poi.lat, lng: currentStop.poi.lon }), [currentStop])
  const mapPois = useMemo(() => [currentStop.poi], [currentStop.poi])
  const mapCourseOrder = useMemo(() => [currentStop.poi.id], [currentStop.poi.id])
  const tracking = !isDemo && (status === 'locating' || status === 'guiding')

  useEffect(() => {
    if (!tracking) return
    const smoother = new HeadingSmoother(8)
    let latestPoint: GeoPoint | null = null
    let latestAccuracy = Number.POSITIVE_INFINITY
    let previousTurn: GuidanceTurn | undefined
    let arrivalCount = 0
    let wakeLock: WakeLockSentinelLike | null = null
    let stopped = false

    const updateDirection = () => {
      const heading = smoother.value
      if (!latestPoint || heading === null) return
      const next = guidanceSnapshot(latestPoint, targetPoint, heading, previousTurn)
      previousTurn = next.turn
      setCurrentHeading(heading)
      setSnapshot(next)
      setStatus('guiding')
    }

    const unsubscribeHeading = subscribeHeading((heading) => {
      smoother.push(heading)
      updateDirection()
    })
    const headingTimer = window.setTimeout(() => {
      if (smoother.value === null) {
        setErrorCopy('나침반 방향을 안정적으로 읽지 못했어요. 카카오맵 또는 GPS 조이스틱을 이용해 주세요.')
        setStatus('error')
      }
    }, 8_000)
    const unwatch = watchCurrentFix(
      (fix) => {
        if (stopped) return
        if (!zoneOf(fix.point)) {
          setErrorCopy('부산 원도심·영도 권역 밖이에요. 카카오맵 또는 GPS 조이스틱을 이용해 주세요.')
          setStatus('error')
          return
        }
        latestPoint = fix.point
        mapPositionRef.current = fix.point
        setMapPosition(fix.point)
        latestAccuracy = fix.accuracyM
        setAccuracyM(fix.accuracyM)
        const distanceM = haversineMeters(fix.point, targetPoint)
        const arrival = advanceArrival(arrivalCount, distanceM, latestAccuracy)
        arrivalCount = arrival.consecutive
        if (arrival.arrived) {
          markVisited(currentStop.poi.id)
          setStatus('arrived')
          return
        }
        if (smoother.value === null) {
          setSnapshot((previous) => ({
            distanceM,
            targetBearingDeg: previous?.targetBearingDeg ?? course.headingDeg,
            relativeDeg: previous?.relativeDeg ?? 0,
            turn: previous?.turn ?? 'forward',
          }))
        }
        updateDirection()
      },
      (error) => {
        setErrorCopy(error.kind === 'denied'
          ? '위치 권한이 거부됐어요. 권한을 허용하거나 GPS 조이스틱을 이용해 주세요.'
          : '현재 위치를 안정적으로 읽지 못했어요.')
        setStatus('error')
      },
    )

    const wake = (navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
    if (wake) void wake.request('screen').then((sentinel) => {
      if (stopped) void sentinel.release()
      else wakeLock = sentinel
    }).catch(() => {})

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') setStatus('paused')
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      latestPoint = null
      mapPositionRef.current = null
      unsubscribeHeading()
      unwatch()
      window.clearTimeout(headingTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLock) void wakeLock.release().catch(() => {})
    }
  }, [course.headingDeg, currentStop, targetPoint, tracking])

  const applyDemoPosition = useCallback((point: GeoPoint, heading: number, sampleCount = 1) => {
    mapPositionRef.current = point
    setMapPosition(point)
    setCurrentHeading(heading)
    const next = guidanceSnapshot(point, targetPoint, heading, snapshot?.turn)
    setSnapshot(next)
    let progress = { consecutive: demoArrivalCountRef.current, arrived: false }
    for (let i = 0; i < sampleCount; i += 1) {
      progress = advanceArrival(progress.consecutive, next.distanceM, 5)
    }
    demoArrivalCountRef.current = progress.consecutive
    if (progress.arrived) {
      markVisited(currentStop.poi.id)
      setStatus('arrived')
    } else {
      setStatus('guiding')
    }
  }, [currentStop.poi.id, snapshot?.turn, targetPoint])

  const moveDemo = useCallback((eastMeters: number, northMeters: number, heading: number) => {
    const current = mapPositionRef.current
    if (!current) return
    applyDemoPosition(movePointMeters(current, eastMeters, northMeters), heading)
  }, [applyDemoPosition])

  const enableManualDemo = () => {
    const nextDemo = demoStart(currentStop, course.headingDeg, currentIndex)
    demoArrivalCountRef.current = 0
    setManualDemo(true)
    setSnapshot(nextDemo.snapshot)
    setCurrentHeading(nextDemo.heading)
    mapPositionRef.current = nextDemo.point
    setMapPosition(nextDemo.point)
    setStatus('guiding')
  }

  const moveNearDestination = () => {
    const bearing = snapshot?.targetBearingDeg ?? course.headingDeg
    const point = pointBeforeTarget(targetPoint, bearing, 38)
    applyDemoPosition(point, bearing, 2)
  }

  const nextStop = () => {
    if (currentIndex >= course.stops.length - 1) {
      setStatus('completed')
      return
    }
    const nextIndex = currentIndex + 1
    const nextCourseStop = course.stops[nextIndex]
    setCurrentIndex(nextIndex)
    setAccuracyM(null)
    demoArrivalCountRef.current = 0
    if (isDemo) {
      const nextDemo = demoStart(nextCourseStop, course.headingDeg, nextIndex)
      setSnapshot(nextDemo.snapshot)
      setCurrentHeading(nextDemo.heading)
      mapPositionRef.current = nextDemo.point
      setMapPosition(nextDemo.point)
      setStatus('guiding')
    } else {
      setSnapshot(null)
      setMapPosition(null)
      mapPositionRef.current = null
      setStatus('locating')
    }
  }

  const mapDeparture: Departure = {
    id: `course-target-${currentStop.poi.id}`,
    name: currentStop.poi.name,
    desc: '활성 코스 안내',
    lat: currentStop.poi.lat,
    lon: currentStop.poi.lon,
  }
  const guidanceUnavailable = status === 'error' || status === 'paused'
  const turn = snapshot?.turn ?? 'forward'
  const instruction = currentStop.method === 'walk' ? TURN_COPY[turn] : METHOD_COPY[currentStop.method]
  const sourceText = `출처: ⓒ한국관광공사${mapProvider === 'kakao' ? ' · 지도: 카카오맵' : mapProvider === 'local' ? ' · 지도 © OpenStreetMap' : ''}`

  return (
    <div className="screen course-nav-screen">
      <div className="course-nav-map" aria-label="현재 위치와 다음 목적지 지도">
        <MapView
          pois={mapPois}
          departure={mapDeparture}
          selectedId={null}
          onPick={() => {}}
          courseOrder={mapCourseOrder}
          currentPosition={mapPosition ?? undefined}
          currentHeadingDeg={currentHeading}
          navigationMode
          followCurrentPosition={isDemo}
          onProviderChange={setMapProvider}
        />
      </div>

      <header className="course-nav-topbar">
        <div><strong>{currentIndex + 1}</strong><span>/ {course.stops.length}</span></div>
        <button type="button" onClick={guidanceUnavailable || status === 'completed' ? onExit : () => setStatus('paused')}>
          {guidanceUnavailable || status === 'completed' ? '종료' : '일시정지'}
        </button>
      </header>

      {isDemo && status !== 'arrived' && status !== 'completed' && (
        <div className="course-nav-demo-float">
          <DemoGpsJoystick onStep={moveDemo} />
        </div>
      )}

      <section className={`course-nav-sheet course-nav-sheet--${status}`} aria-live="polite">
        <div className="course-nav-sheet__handle" aria-hidden />

        {status === 'completed' ? (
          <div className="course-nav-complete">
            <span>코스 완료</span>
            <h1>오늘의 코스를 모두 만났어요</h1>
            <p>{course.stops.length}곳을 방향에 맡겨 둘러봤어요.</p>
            <button type="button" className="btn btn-blue" onClick={onExit}>스핀으로 돌아가기</button>
          </div>
        ) : status === 'arrived' ? (
          <div className="course-nav-arrived">
            <div className="course-nav-arrived__photo"><PoiPhoto contentId={currentStop.poi.contentId} alt={currentStop.poi.name} scrim /></div>
            <div className="course-nav-arrived__copy">
              <span>도착했어요!</span>
              <h1>{currentStop.poi.name}</h1>
              <p>{copyOf(currentStop.poi.contentId) ?? currentStop.poi.story}</p>
            </div>
            <button type="button" className="btn btn-blue" onClick={nextStop}>{currentIndex === course.stops.length - 1 ? '코스 마치기' : '다음 경로'}</button>
          </div>
        ) : guidanceUnavailable ? (
          <div className="course-nav-fallback">
            <h1>{status === 'paused' ? '안내를 잠시 멈췄어요' : '센서 안내를 사용할 수 없어요'}</h1>
            <p>{status === 'paused' ? '계속하려면 아래 버튼을 눌러 주세요.' : errorCopy}</p>
            {status === 'paused' && orientationPermission === 'granted' && !isDemo && (
              <button type="button" className="btn btn-blue" onClick={() => setStatus('locating')}>안내 계속하기</button>
            )}
            <button type="button" className="btn" onClick={enableManualDemo}>GPS 조이스틱 사용</button>
          </div>
        ) : (
          <div className="course-nav-guidance">
            <div className="course-nav-guidance__row">
              <div className={`course-nav-turn${status === 'locating' ? ' is-locating' : ''}`} style={{ transform: `rotate(${TURN_ROTATION[turn]}deg)` }} aria-hidden>
                <span />
              </div>
              <div className="course-nav-guidance__copy">
                <span>{isDemo ? 'GPS 시연 안내' : status === 'locating' ? '위치 확인 중' : '다음 이동'}</span>
                <h1>{status === 'locating' ? '현재 방향을 찾고 있어요' : instruction}</h1>
              </div>
            </div>
            <div className="course-nav-destination">
              <div><span>다음 장소</span><strong>{currentStop.poi.name}</strong></div>
              <div className="course-nav-distance"><strong>{distanceLabel(snapshot?.distanceM ?? null)}</strong>{accuracyM !== null && <span>GPS ±{Math.round(accuracyM)}m</span>}</div>
            </div>
            <div className="course-nav-actions">
              <a className="btn" href={kakaoMapDirectionsUrl(currentStop.poi.name, currentStop.poi.lat, currentStop.poi.lon)} target="_blank" rel="noreferrer">카카오맵</a>
              {isDemo && <button type="button" className="btn" onClick={moveNearDestination}>도착 위치로 이동</button>}
            </div>
          </div>
        )}

        <p className="course-nav-source">{sourceText}</p>
      </section>
    </div>
  )
}
