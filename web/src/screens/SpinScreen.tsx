import { useCallback, useEffect, useRef, useState } from 'react'
import { CompassRose } from '../components/CompassRose'
import { ScreenFrame } from '../components/ScreenFrame'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { DialSlider } from '../components/DialSlider'
import { DIRECTIONS, directionFromHeading, type Departure } from '../mock/pois'
import type { ThemeInfo } from '../engine/themes'
import { useFieldMode } from '../sensors/useFieldMode'

export type SpinPurpose = 'single' | 'course'

interface Props {
  departure: Departure
  /** 이동시간 예산(분) — Infinity = 하루 */
  dial: number
  onDialChange: (minutes: number) => void
  onOpenDeparture: () => void
  onSpun: (headingDeg: number) => void
  onNavigate: (tab: NavTab) => void
  theme?: ThemeInfo
  themeStep?: number
  themeTarget?: number
  onOpenTheme: () => void
  onClearTheme: () => void
  purpose: SpinPurpose
  onPurposeChange: (purpose: SpinPurpose) => void
  purposeNotice?: string | null
  /** 현장 모드 출발점(현재 위치)이 바뀔 때 알린다. 여행 모드로 돌아오면 null */
  onFieldOriginChange: (origin: Departure | null) => void
}

/**
 * 스핀 탭 — 밤바다 몰입 화면.
 * 여행 모드는 원판을 직접 드래그해, 현장 모드는 실제 기기 방위로 방향을 정한다.
 */
export function SpinScreen({ departure, dial, onDialChange, onOpenDeparture, onSpun, onNavigate, theme, themeStep, themeTarget, onOpenTheme, onClearTheme, purpose, onPurposeChange, purposeNotice, onFieldOriginChange }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [settled, setSettled] = useState(false)
  const [dirIndex, setDirIndex] = useState(0)
  const liveDir = DIRECTIONS[dirIndex]
  const field = useFieldMode()
  const fieldOn = field.status === 'on'

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
      setSettled(true)
      setTimeout(() => onSpun(heading), 700) // 정지 방위를 잠깐 보여주고 연출 화면으로
    },
    [onSpun],
  )

  const busy = spinning || settled

  /** 기기를 겨눈 채 방위가 안정되면 자동 잠금 — 수동 `이 방향으로 결정`과 같은 각도를 쓴다. */
  useEffect(() => {
    if (!fieldOn || !field.aimed || busy || field.heading === null) return
    handleSettle(field.heading)
  }, [busy, field.aimed, field.heading, fieldOn, handleSettle])

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 2 }}>
        <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4, color: 'var(--l-ink)' }}>스핀</span>
        {fieldOn ? (
          <button
            type="button"
            onClick={field.disable}
            aria-label="나침반 현장 모드 종료"
            style={{ minHeight: 44, border: 0, background: 'transparent', padding: '8px 0 8px 12px', color: 'var(--l-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
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

      <div className="spin-purpose" aria-label="스핀 목적">
        <button type="button" className={purpose === 'single' ? 'is-active' : ''} onClick={() => onPurposeChange('single')}>한 곳</button>
        <button type="button" className={purpose === 'course' ? 'is-active' : ''} onClick={() => onPurposeChange('course')}>코스</button>
      </div>
      {purposeNotice && <p className="spin-purpose-notice" role="status">{purposeNotice}</p>}

      <div className="spin-heading">
        {busy ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--l-ink-3)' }}>{settled ? '오늘의 방향은' : '방향을 찾는 중…'}</div>
            <div style={{ marginTop: 4, fontSize: 34, fontWeight: 900, letterSpacing: -0.5, color: settled ? liveDir.color : 'var(--l-ink)', transition: 'color .3s ease' }}>
              {liveDir.label}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--l-ink)' }}>{fieldOn ? '휴대폰을 돌려 방향을 겨눠보세요' : purpose === 'course' ? '한 번 돌려 오늘의 코스를 만들어요' : theme ? `${theme.label} 테마, 어느 쪽으로 갈까요?` : '오늘, 어느 쪽으로 갈까요?'}</h1>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>{fieldOn ? '겨눈 방향에서 잠시 멈추면 그 방위로 정해져요' : purpose === 'course' ? '같은 방향의 장소 2~4곳을 이어드려요' : theme ? '선택한 테마 안에서 방향이 장소를 골라줘요' : '원판을 휙 돌리고, 방향에 맡겨보세요'}</p>
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
            disabled={settled}
            describedById={!fieldOn && !busy ? 'spin-gesture-instruction' : undefined}
            onSpinningChange={setSpinning}
            onHeading={handleHeading}
            onSettle={handleSettle}
            followHeading={fieldOn && !settled ? field.heading : null}
          />
          {theme && purpose === 'single' && !busy && (
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
          원판을 잡고 휙 돌려보세요
        </p>
      </div>

      {/* 하단에는 이동시간 카드만 남기고, 스핀 실행은 원판 직접 조작으로 일원화한다. */}
      <div className="spin-controls">
        <div style={{ pointerEvents: busy ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {theme && purpose === 'single' && (
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
        </div>
      </div>

      <BottomNav active="spin" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
