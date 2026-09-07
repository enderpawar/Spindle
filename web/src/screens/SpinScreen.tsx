import { useCallback, useEffect, useRef, useState } from 'react'
import { CompassRose, type CompassRoseHandle } from '../components/CompassRose'
import { ScreenFrame } from '../components/ScreenFrame'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { DialSlider } from '../components/DialSlider'
import { DIRECTIONS, directionFromHeading, type Departure } from '../mock/pois'
import type { ThemeInfo } from '../engine/themes'
import type { SpinCategory } from '../engine/diningSpin'
import { useFieldMode } from '../sensors/useFieldMode'
import { useShakeSpin } from '../sensors/useShakeSpin'


interface Props {
  departure: Departure
  /** 이동시간 예산(분) — Infinity = 하루 */
  dial: number
  onDialChange: (minutes: number) => void
  onOpenDeparture: () => void
  onSpun: (headingDeg: number) => boolean | void
  category: SpinCategory
  onCategoryChange: (category: SpinCategory) => void
  categoryLoading: boolean
  categoryError: string | null
  categoryNotice: string | null
  onRetryCategory: () => void
  onNavigate: (tab: NavTab) => void
  theme?: ThemeInfo
  themeStep?: number
  themeTarget?: number
  onOpenTheme: () => void
  onClearTheme: () => void
  /** 현장 모드 출발점(현재 위치)이 바뀔 때 알린다. 여행 모드로 돌아오면 null */
  onFieldOriginChange: (origin: Departure | null) => void
}

/**
 * 스핀 탭 — 밤바다 몰입 화면.
 * 여행 모드는 원판을 직접 드래그해, 현장 모드는 실제 기기 방위로 방향을 정한다.
 */
export function SpinScreen({ departure, dial, onDialChange, onOpenDeparture, onSpun, onNavigate, theme, themeStep, themeTarget, onOpenTheme, onClearTheme, onFieldOriginChange, category, onCategoryChange, categoryLoading, categoryError, categoryNotice, onRetryCategory }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [settled, setSettled] = useState(false)
  const [dirIndex, setDirIndex] = useState(0)
  const liveDir = DIRECTIONS[dirIndex]
  const field = useFieldMode()
  const fieldOn = field.status === 'on'
  const dataBlocked = categoryLoading || !!categoryError
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const failedHeading = useRef<number | null>(null)
  useEffect(() => () => clearTimeout(settleTimer.current), [])

  // 흔들기 스핀 — 흔드는 동안 원판에 회전 에너지를 넣고, 멈추면 원판이 알아서 감속·정착한다.
  const roseRef = useRef<CompassRoseHandle>(null)
  const handleShake = useCallback((energy: number) => {
    if (!dataBlocked) roseRef.current?.shake(energy)
  }, [dataBlocked])
  const shake = useShakeSpin(handleShake)
  const shakeOn = shake.status === 'on' && !fieldOn

  // 현장 모드에서는 현재 위치가 출발점이 된다 — 좌표는 App 상태(메모리)까지만 올라간다.
  useEffect(() => {
    onFieldOriginChange(field.origin)
  }, [field.origin, onFieldOriginChange])

  // 방위 라벨이 바뀔 때만 리렌더 (매 프레임 setState 방지)
  const lastIndex = useRef(0)
  const handleHeading = useCallback((heading: number) => {
    const idx = DIRECTIONS.indexOf(directionFromHeading(heading))
    if (idx !== lastIndex.current) {
      lastIndex.current = idx
      setDirIndex(idx)
    }
  }, [])

  const handleSettle = useCallback(
    (heading: number) => {
      if (dataBlocked) return
      setSettled(true)
      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => {
        if (onSpun(heading) === false) {
          failedHeading.current = heading
          setSettled(false)
          setSpinning(false)
        }
      }, 700)
    },
    [dataBlocked, onSpun],
  )

  const busy = spinning || settled

  /** 기기를 겨눈 채 방위가 안정되면 자동 잠금 — 수동 `이 방향으로 결정`과 같은 각도를 쓴다. */
  useEffect(() => {
    if (!fieldOn || !field.aimed || busy || dataBlocked || field.heading === null) return
    // 후보가 없는 동일 방위로 자동 스핀을 반복하지 않고, 다른 방위를 겨누면 다시 시도한다.
    if (categoryNotice && failedHeading.current !== null
      && directionFromHeading(field.heading).id === directionFromHeading(failedHeading.current).id) return
    handleSettle(field.heading)
  }, [busy, categoryNotice, dataBlocked, field.aimed, field.heading, fieldOn, handleSettle])

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, color: 'var(--l-ink)' }}>스핀</span>
        {fieldOn ? (
          <button
            type="button"
            onClick={field.disable}
            aria-label="나침반 현장 모드 종료"
            style={{ minHeight: 44, border: 0, background: 'transparent', padding: '8px 0 8px 12px', color: 'var(--l-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', flex: 'none' }} />
            내 위치 기준 · 나침반
          </button>
        ) : (
          <div className="spin-header-actions">
            <button
              type="button"
              className="spin-compass-mode-button"
              onClick={() => void field.enable()}
              disabled={field.status === 'requesting'}
              aria-label={field.status === 'requesting' ? '나침반 준비 중' : '내 위치 나침반 모드 시작'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button
              onClick={onOpenDeparture}
              className="spin-departure-button"
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', flex: 'none' }} />
              {departure.name} 기준
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
                <path d="M7 10 l5 5 5-5" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {!theme && <div className="spin-category-switch" role="group" aria-label="스핀 장소 종류">
        {(['전체', '음식점', '카페'] as const).map(value => <button key={value} type="button" disabled={busy}
          aria-pressed={category === value} className={category === value ? 'is-active' : ''}
          onClick={() => onCategoryChange(value)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {value === '전체' ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></> : value === '음식점' ? <><path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 21V3c-4 3-4 8 0 9" /></> : <><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 9h2a3 3 0 0 1 0 6h-2M7 3v2M12 3v2" /></>}
          </svg>
          <span>{value === '전체' ? '관광지' : value}</span>
        </button>)}
      </div>}
      {theme && <div className="spin-category-context">{theme.label} 테마 적용 중 <button type="button" disabled={busy} onClick={onClearTheme}>해제</button></div>}
      {(categoryLoading || categoryError || categoryNotice) && <div className="spin-category-status" role={categoryError ? 'alert' : 'status'}>
        {categoryLoading ? `${category}를 불러오는 중이에요` : categoryError ?? categoryNotice}
        {categoryError && <button type="button" onClick={onRetryCategory}>다시 시도</button>}
      </div>}

      <div className="spin-heading">
        {busy ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)' }}>{settled ? '오늘의 방향은' : '방향을 찾는 중…'}</div>
            <div style={{ marginTop: 4, fontSize: 34, fontWeight: 800, letterSpacing: -0.5, color: settled ? liveDir.color : 'var(--l-ink)', transition: 'color .3s ease' }}>
              {liveDir.label}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: 'var(--l-ink)' }}>{fieldOn ? '휴대폰을 돌려 방향을 겨눠보세요' : theme ? `${theme.label} 테마, 어느 쪽으로 갈까요?` : category === '음식점' ? '오늘, 어디서 먹을까요?' : category === '카페' ? '잠깐, 커피 한 잔 할까요?' : '오늘, 어느 쪽으로 갈까요?'}</h1>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, fontWeight: 500, color: 'var(--l-ink-3)' }}>{fieldOn ? '겨눈 방향에서 잠시 멈추면 그 방위로 정해져요' : theme ? '선택한 테마 안에서 방향이 장소를 골라줘요' : category !== '전체' ? `방향에 맞춰 ${category} 한 곳을 추천해요` : '방향에 맞춰 여행지를 추천해요'}</p>
          </>
        )}
      </div>

      <div className="spin-compass-stage">
        <div className="spin-compass-shell">
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-14%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${settled ? liveDir.color : theme?.color ?? 'rgba(91,147,255,.9)'} 0%, transparent 62%)`,
              opacity: settled ? 0.34 : 0.14,
              transition: 'opacity .4s ease',
              pointerEvents: 'none',
            }}
          />
          <CompassRose
            ref={roseRef}
            disabled={settled || dataBlocked}
            describedById={!fieldOn && !busy ? 'spin-gesture-instruction' : undefined}
            onSpinningChange={setSpinning}
            onHeading={handleHeading}
            onSettle={handleSettle}
            followHeading={fieldOn && !settled ? field.heading : null}
          />
          {theme && !busy && (
            <div className="spin-theme-disc-mark" style={{ '--theme-color': theme.color } as React.CSSProperties}>
              {theme.label} 디스크
            </div>
          )}
        </div>
        <p
          id="spin-gesture-instruction"
          className={`spin-gesture-cue${fieldOn || busy ? ' is-hidden' : ''}`}
          aria-hidden={fieldOn || busy}
        >
          <span className="spin-gesture-cue-mark" aria-hidden />
          {shakeOn ? '밀어서 돌리기 · 휴대폰 흔들기' : '원판을 밀어서 돌려보세요'}
        </p>
      </div>

      {/* 하단에는 이동시간 카드만 남기고, 스핀 실행은 원판 직접 조작으로 일원화한다. */}
      <div className="spin-controls">
        <div style={{ pointerEvents: busy ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {theme && (
            <div className="spin-theme-control">
              <div>
                <strong style={{ color: theme.color }}>{theme.label}</strong>
                <span>{themeStep}/{themeTarget}번째 장면</span>
              </div>
              <button type="button" onClick={onOpenTheme}>바꾸기</button>
              <button type="button" onClick={onClearTheme}>해제</button>
            </div>
          )}
          <DialSlider minutes={dial} onChange={onDialChange} />

          {field.notice && <p className="spin-field-notice" role="status">{field.notice}</p>}
          {shake.notice && <p className="spin-field-notice" role="status">{shake.notice}</p>}
        </div>
      </div>

      <BottomNav active="spin" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
