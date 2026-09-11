/**
 * 좁은 폰에서도 390px 원본 배치를 유지한다 (docs/ui.md — 390×844 기준).
 *
 * iPhone "디스플레이 확대/축소 → 더 큰 텍스트"는 CSS 뷰포트를 320px로 만들고, 갤럭시 계열은
 * 360px이다. 그 폭에서는 좁은 화면용 미디어쿼리가 배치를 다시 짜서 명소 부제목이 두 줄로
 * 갈라지고 종류 탭 옆의 지역 선택이 다음 줄로 떨어졌다. 짧은 변이 390보다 좁으면 레이아웃
 * 폭을 390으로 고정해 같은 배치를 그대로 두고, 브라우저·WebView가 화면 폭에 맞춰 축소하게 한다.
 *
 * 기기 폭은 `innerWidth`가 아니라 `screen`의 짧은 변으로 잰다 — 고정한 뒤에는 innerWidth가
 * 390을 보고하므로 되돌릴 기준이 사라진다(iOS의 screen.width는 회전해도 세로 기준이지만
 * Android는 바뀐다).
 *
 * 고정은 세로에서만 한다. Android 앱과 모바일 브라우저 탭은 가로로 돌아가는데, 360×740
 * 화면을 가로로 들고 390 폭을 유지하면 약 1.9배 확대되어 앱 프레임 높이가 190px 남짓으로
 * 짓눌린다. 고정 중에도 가로로 돌리면 390 폭 레이아웃이 가로 비율로 보고되므로
 * `(orientation: portrait)` 판정은 고정 여부와 무관하게 정확하다.
 *
 * Android 앱 WebView는 useWideViewPort가 켜져 있어야 `width=`를 따른다 (MainActivity.java).
 */
export const DESIGN_WIDTH = 390

export const DEVICE_WIDTH_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

export function viewportContentFor(shortSide: number, portrait: boolean): string {
  if (!portrait || !Number.isFinite(shortSide) || shortSide <= 0 || shortSide >= DESIGN_WIDTH) {
    return DEVICE_WIDTH_VIEWPORT
  }
  return `width=${DESIGN_WIDTH}, viewport-fit=cover`
}

function applyDesignViewport(meta: HTMLMetaElement) {
  const next = viewportContentFor(
    Math.min(window.screen.width, window.screen.height),
    window.matchMedia('(orientation: portrait)').matches,
  )
  if (meta.content !== next) meta.content = next
}

export function lockDesignViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return
  applyDesignViewport(meta)
  // DevTools 기기 전환처럼 화면 자체가 바뀌는 경우에만 값이 달라진다.
  const reapply = () => applyDesignViewport(meta)
  window.addEventListener('resize', reapply)
  window.addEventListener('orientationchange', reapply)
}
