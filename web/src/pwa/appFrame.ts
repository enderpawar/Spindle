/* 앱 프레임 실측 — iOS 홈화면 실행(standalone)의 하단 죽은 띠 보정.
 *
 * `apple-mobile-web-app-status-bar-style: black-translucent`로 실행하면 콘텐츠는
 * 화면 맨 위(상태바 아래)부터 그려지지만, WebKit이 레이아웃 뷰포트 높이는 상태바
 * 높이만큼 짧게 보고한다. 그래서 `position: fixed; inset: 0`인 앱 프레임과
 * `bottom: 0`인 하단 내비게이션이 실제 화면 바닥보다 그 높이만큼 위에 멈춘다.
 *
 * 상태바 높이를 상수로 가정하면 기기·OS 업데이트마다 틀어지므로, 화면 높이와
 * 뷰포트 높이의 차이를 실측해서 CSS 변수(--app-bottom-gap)로 노출한다. WebKit이
 * 이 동작을 고치면 차이가 0이 되어 보정도 자동으로 사라진다.
 */

export const BOTTOM_GAP_VAR = '--app-bottom-gap'

/** 보정으로 인정할 최대 띠 높이 — 상태바(대략 20~62px)를 넘는 값은 오측정으로 본다. */
const MAX_GAP = 80

export type FrameMetricsInput = {
  /** iOS 홈화면 실행 여부 (`navigator.standalone`). 이 버그는 iOS standalone 전용이다. */
  iosStandalone: boolean
  /** CSS 픽셀 기준 화면 높이 (`screen.height`) */
  screenHeight: number
  /** CSS 픽셀 기준 화면 너비 (`screen.width`) */
  screenWidth: number
  /** 레이아웃 뷰포트 높이 (`innerHeight`) */
  innerHeight: number
}

export function computeBottomGap(input: FrameMetricsInput): number {
  const { iosStandalone, screenHeight, screenWidth, innerHeight } = input
  // Android·데스크톱·Safari 탭은 이 버그가 없다. 그쪽 screen/innerHeight 차이는
  // 시스템 바 높이라서 보정에 쓰면 내비게이션이 화면 밖으로 밀린다.
  if (!iosStandalone) return 0
  if (!Number.isFinite(screenHeight) || !Number.isFinite(innerHeight)) return 0
  // 가로 모드는 상태바가 없어 보정 대상이 아니다 (앱은 세로 고정이지만 방어).
  if (screenHeight <= screenWidth) return 0
  const gap = Math.round(screenHeight - innerHeight)
  if (gap <= 1 || gap > MAX_GAP) return 0
  return gap
}

function readMetrics(win: Window): FrameMetricsInput {
  const nav = win.navigator as Navigator & { standalone?: boolean }
  return {
    iosStandalone: nav.standalone === true,
    screenHeight: win.screen?.height ?? 0,
    screenWidth: win.screen?.width ?? 0,
    innerHeight: win.innerHeight,
  }
}

/** 측정값을 문서 루트의 CSS 변수로 반영하고, 뷰포트가 바뀔 때마다 다시 맞춘다. */
export function installAppFrameMetrics(win: Window = window): () => void {
  const root = win.document.documentElement
  const apply = () => {
    root.style.setProperty(BOTTOM_GAP_VAR, `${computeBottomGap(readMetrics(win))}px`)
  }
  apply()

  const onChange = () => {
    // 회전 직후에는 innerHeight가 아직 이전 값이라 다음 프레임에 다시 잰다.
    apply()
    win.requestAnimationFrame(apply)
  }
  win.addEventListener('resize', onChange)
  win.addEventListener('orientationchange', onChange)
  win.visualViewport?.addEventListener('resize', onChange)

  return () => {
    win.removeEventListener('resize', onChange)
    win.removeEventListener('orientationchange', onChange)
    win.visualViewport?.removeEventListener('resize', onChange)
  }
}
