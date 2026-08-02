import { useEffect, useState } from 'react'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { advanceArrival, guidanceSnapshot, type GuidanceSnapshot, type GuidanceTurn } from '../engine/courseGuidance'
import { haversineMeters, type GeoPoint } from '../engine/geo'
import { HeadingSmoother } from '../engine/heading'
import type { CourseStopView, ReadyCourse } from '../engine/spinCourse'
import { zoneOf } from '../engine/zones'
import { copyOf } from '../engine/curation'
import { kakaoMapDirectionsUrl } from '../lib/mapLinks'
import { markVisited } from '../lib/visited'
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
  forward: '직진 방향으로 계속 가요',
  right: '다음 장소는 오른쪽 방향이에요',
  left: '다음 장소는 왼쪽 방향이에요',
  behind: '뒤쪽 방향으로 돌아봐요',
}

const TURN_ROTATION: Record<GuidanceTurn, number> = {
  forward: 0,
  right: 90,
  left: -90,
  behind: 180,
}

const METHOD_COPY: Record<CourseStopView['method'], string> = {
  walk: '방향을 따라 걸어가요',
  bridge: '다리를 건너 이동해야 해요',
  transit: '대중교통으로 이동하는 구간이에요',
  estimate: '카카오맵에서 실제 경로를 먼저 확인해 주세요',
}

function distanceLabel(distanceM: number | null): string {
  if (distanceM === null) return '거리 확인 중'
  if (distanceM < 1000) return `직선거리 약 ${Math.max(0, Math.round(distanceM / 10) * 10)}m`
  return `직선거리 약 ${(distanceM / 1000).toFixed(1)}km`
}

export function CourseGuideScreen({ course, orientationPermission, demo = false, onExit }: Props) {
  const [manualDemo, setManualDemo] = useState(false)
  const isDemo = demo || manualDemo
  const [currentIndex, setCurrentIndex] = useState(0)
  const [status, setStatus] = useState<GuideStatus>(() => demo ? 'guiding' : orientationPermission === 'granted' ? 'locating' : 'error')
  const [snapshot, setSnapshot] = useState<GuidanceSnapshot | null>(() => demo ? {
    distanceM: 320,
    targetBearingDeg: course.headingDeg,
    relativeDeg: 0,
    turn: 'forward',
  } : null)
  const [accuracyM, setAccuracyM] = useState<number | null>(null)
  const [errorCopy, setErrorCopy] = useState(() => orientationPermission === 'denied'
    ? '나침반 권한이 없어 방향 안내를 시작할 수 없어요.'
    : orientationPermission === 'unsupported'
      ? '이 기기에서는 나침반 방향을 읽을 수 없어요.'
      : '')

  const currentStop = course.stops[currentIndex]
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
    const target = { lat: currentStop.poi.lat, lng: currentStop.poi.lon }

    const updateDirection = () => {
      const heading = smoother.value
      if (!latestPoint || heading === null) return
      const next = guidanceSnapshot(latestPoint, target, heading, previousTurn)
      previousTurn = next.turn
      setSnapshot(next)
      setStatus('guiding')
    }

    const unsubscribeHeading = subscribeHeading((heading) => {
      smoother.push(heading)
      updateDirection()
    })
    const headingTimer = window.setTimeout(() => {
      if (smoother.value === null) {
        setErrorCopy('나침반 방향을 안정적으로 읽지 못했어요. 카카오맵 또는 수동 미리보기를 이용해 주세요.')
        setStatus('error')
      }
    }, 8_000)
    const unwatch = watchCurrentFix(
      (fix) => {
        if (stopped) return
        if (!zoneOf(fix.point)) {
          setErrorCopy('부산 원도심·영도 권역 밖이에요. 카카오맵 또는 수동 미리보기를 이용해 주세요.')
          setStatus('error')
          return
        }
        latestPoint = fix.point
        latestAccuracy = fix.accuracyM
        setAccuracyM(fix.accuracyM)
        const distanceM = haversineMeters(fix.point, target)
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
          ? '위치 권한이 거부됐어요. 권한을 허용하거나 다른 안내를 이용해 주세요.'
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
      unsubscribeHeading()
      unwatch()
      window.clearTimeout(headingTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLock) void wakeLock.release().catch(() => {})
    }
  }, [course.headingDeg, currentStop, tracking])

  const showArrival = () => {
    markVisited(currentStop.poi.id)
    setStatus('arrived')
  }

  const nextStop = () => {
    if (currentIndex >= course.stops.length - 1) {
      setStatus('completed')
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setSnapshot(isDemo ? {
      distanceM: 260 + nextIndex * 90,
      targetBearingDeg: course.headingDeg,
      relativeDeg: nextIndex % 2 ? 75 : -65,
      turn: nextIndex % 2 ? 'right' : 'left',
    } : null)
    setAccuracyM(null)
    setStatus(isDemo ? 'guiding' : 'locating')
  }

  if (status === 'completed') {
    return (
      <ScreenFrame style={{ background: 'var(--l-bg)', padding: '24px 22px calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="course-guide-complete">
          <span aria-hidden>✦</span>
          <p>코스 완료</p>
          <h1>오늘의 코스를<br />모두 만났어요</h1>
          <p>{course.stops.length}곳을 방향에 맡겨 둘러봤어요.</p>
        </div>
        <SourceLine style={{ marginTop: 'auto' }} />
        <button type="button" className="btn btn-blue" style={{ height: 56, marginTop: 16 }} onClick={onExit}>스핀으로 돌아가기</button>
      </ScreenFrame>
    )
  }

  if (status === 'arrived') {
    return (
      <ScreenFrame style={{ background: 'var(--l-bg)' }}>
        <header className="course-guide-header"><span>{currentIndex + 1} / {course.stops.length}</span><button type="button" onClick={onExit}>종료</button></header>
        <div className="course-arrival-photo"><PoiPhoto contentId={currentStop.poi.contentId} alt={currentStop.poi.name} scrim /></div>
        <main className="course-arrival-copy">
          <p>도착했어요!</p>
          <h1>{currentStop.poi.name}</h1>
          <p>{copyOf(currentStop.poi.contentId) ?? currentStop.poi.story}</p>
        </main>
        <SourceLine style={{ marginTop: 'auto' }} />
        <div className="course-guide-actions">
          <button type="button" className="btn btn-blue" onClick={nextStop}>{currentIndex === course.stops.length - 1 ? '코스 마치기' : '다음 경로'}</button>
        </div>
      </ScreenFrame>
    )
  }

  const guidanceUnavailable = status === 'error' || status === 'paused'
  const turn = snapshot?.turn ?? 'forward'
  const nonWalk = currentStop.method !== 'walk'

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header className="course-guide-header">
        <span>{currentIndex + 1} / {course.stops.length}</span>
        <button type="button" onClick={guidanceUnavailable ? onExit : () => setStatus('paused')}>{guidanceUnavailable ? '종료' : '일시정지'}</button>
      </header>
      <main className="course-guide-main">
        <div className="course-guide-kicker">다음 장소</div>
        <h1>{currentStop.poi.name}</h1>
        {isDemo && <div className="course-demo-badge">심사용 수동 데모</div>}

        {guidanceUnavailable ? (
          <section className="course-guide-fallback" role="status">
            <h2>{status === 'paused' ? '안내를 잠시 멈췄어요' : '센서 안내를 사용할 수 없어요'}</h2>
            <p>{status === 'paused' ? '계속하려면 아래 버튼을 눌러 주세요.' : errorCopy}</p>
            {status === 'paused' && orientationPermission === 'granted' && (
              <button type="button" className="btn btn-blue" onClick={() => setStatus('locating')}>안내 계속하기</button>
            )}
            <button type="button" className="btn" onClick={() => {
              setManualDemo(true)
              setSnapshot({ distanceM: 320, targetBearingDeg: course.headingDeg, relativeDeg: 0, turn: 'forward' })
              setStatus('guiding')
            }}>수동으로 미리보기</button>
          </section>
        ) : (
          <>
            {nonWalk && <div className="course-method-card"><strong>{METHOD_COPY[currentStop.method]}</strong><span>약 {currentStop.legMinutes}분 구간</span></div>}
            {!nonWalk && (
              <div className={`course-guide-arrow${status === 'locating' ? ' is-locating' : ''}`} style={{ transform: `rotate(${TURN_ROTATION[turn]}deg)` }} aria-hidden>
                <svg viewBox="0 0 120 140"><path d="M60 8 L108 62 H78 V132 H42 V62 H12 Z" /></svg>
              </div>
            )}
            <h2>{nonWalk ? '먼저 이동 구간을 확인해요' : status === 'locating' ? '현재 방향을 찾는 중…' : TURN_COPY[turn]}</h2>
            <p className="course-guide-distance">{distanceLabel(snapshot?.distanceM ?? null)}</p>
            {accuracyM !== null && <p className="course-guide-accuracy">GPS 정확도 약 {Math.round(accuracyM)}m</p>}
            {isDemo && <button type="button" className="btn course-demo-arrive" onClick={showArrival}>도착 화면 보기</button>}
          </>
        )}
      </main>

      <div className="course-guide-map-note">
        <p>실제 도보 경로는 카카오맵에서 확인해 주세요.</p>
        <a className="btn" href={kakaoMapDirectionsUrl(currentStop.poi.name, currentStop.poi.lat, currentStop.poi.lon)} target="_blank" rel="noreferrer">카카오맵 길찾기</a>
      </div>
      <SourceLine style={{ margin: '8px 20px calc(14px + env(safe-area-inset-bottom))' }} />
    </ScreenFrame>
  )
}
