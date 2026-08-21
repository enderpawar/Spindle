import { describe, expect, it } from 'vitest'
import { backActionFor, type BackAction, type BackContext } from './backAction'
import { SCREENS, type Screen } from '../navigationMotion'

/** 복귀 상태를 서로 다른 값으로 둬서 목적지가 뒤바뀌면 바로 드러나게 한다. */
const RETURNS: Omit<BackContext, 'screen'> = {
  departureReturn: 'settings',
  poiReturn: 'spots',
  courseReturn: 'spin',
  themeReturn: 'stamp',
}

/**
 * Record<Screen, ...>라 화면이 하나라도 늘면 **컴파일이 깨진다** —
 * 뒤로가기 목적지가 비어 앱이 즉시 종료되는 회귀를 타입 단계에서 막는다.
 */
const EXPECTED: Record<Screen, BackAction> = {
  onboarding: { kind: 'confirmExit' },
  home: { kind: 'confirmExit' },
  spots: { kind: 'goTo', screen: 'home' },
  spin: { kind: 'goTo', screen: 'home' },
  stamp: { kind: 'goTo', screen: 'home' },
  settings: { kind: 'goTo', screen: 'home' },
  departure: { kind: 'goTo', screen: 'settings' },
  'origin-pick': { kind: 'goTo', screen: 'departure' },
  reveal: { kind: 'goTo', screen: 'spin' },
  result: { kind: 'goTo', screen: 'spots' },
  course: { kind: 'goTo', screen: 'spin' },
  share: { kind: 'goTo', screen: 'result' },
  theme: { kind: 'goTo', screen: 'stamp' },
  festival: { kind: 'goTo', screen: 'home' },
}

describe('backActionFor', () => {
  it('모든 화면에 뒤로가기 목적지가 정의돼 있다', () => {
    // 표가 아니라 실제 화면 목록을 돈다 — 화면을 추가하고 뒤로가기를 잊으면 여기서 걸린다.
    expect(Object.keys(EXPECTED).sort()).toEqual([...SCREENS].sort())
    for (const screen of SCREENS) {
      expect(backActionFor({ ...RETURNS, screen })).toEqual(EXPECTED[screen])
    }
  })

  it('뒤로가기 목적지가 현재 화면과 같아지지 않는다', () => {
    // goTo는 목적지가 현재 화면이면 아무 일도 하지 않는다(App.tsx) — 눌러도 반응이 없는 상태를 막는다.
    for (const screen of SCREENS) {
      for (const ret of SCREENS) {
        const action = backActionFor({
          screen,
          departureReturn: ret,
          poiReturn: ret,
          courseReturn: ret,
          themeReturn: ret,
        })
        if (action.kind === 'goTo') expect(action.screen).not.toBe(screen)
      }
    }
  })

  it('스택 바닥에서만 종료를 확인한다', () => {
    expect(backActionFor({ ...RETURNS, screen: 'home' })).toEqual({ kind: 'confirmExit' })
    expect(backActionFor({ ...RETURNS, screen: 'onboarding' })).toEqual({ kind: 'confirmExit' })
  })

  it('탭 화면에서는 앱을 끄지 않고 홈으로 돌아간다', () => {
    for (const screen of ['spots', 'spin', 'stamp', 'settings'] as const) {
      expect(backActionFor({ ...RETURNS, screen })).toEqual({ kind: 'goTo', screen: 'home' })
    }
  })

  it('드릴다운 화면은 저마다의 복귀 상태를 따른다', () => {
    expect(backActionFor({ ...RETURNS, screen: 'departure' })).toEqual({ kind: 'goTo', screen: 'settings' })
    expect(backActionFor({ ...RETURNS, screen: 'result' })).toEqual({ kind: 'goTo', screen: 'spots' })
    expect(backActionFor({ ...RETURNS, screen: 'course' })).toEqual({ kind: 'goTo', screen: 'spin' })
    expect(backActionFor({ ...RETURNS, screen: 'theme' })).toEqual({ kind: 'goTo', screen: 'stamp' })
  })

  it('복귀 상태가 바뀌면 목적지도 따라간다', () => {
    const fromHome = backActionFor({ ...RETURNS, poiReturn: 'home', screen: 'result' })
    expect(fromHome).toEqual({ kind: 'goTo', screen: 'home' })
  })

  it('리빌 연출에서 뒤로가면 스핀으로 되돌아간다', () => {
    expect(backActionFor({ ...RETURNS, screen: 'reveal' })).toEqual({ kind: 'goTo', screen: 'spin' })
  })
})
