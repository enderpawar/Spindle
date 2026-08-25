/**
 * 네이티브 셸(Capacitor) 판정 — 웹 번들에 `@capacitor/core`를 끌어들이지 않는다.
 *
 * 브라우저에는 이 전역이 없다. 네이티브 브리지(`native-bridge.js`)가 페이지 스크립트보다
 * 먼저 `window.Capacitor`를 주입하므로, 플러그인을 정적 import 하지 않고도 판정할 수 있다.
 * 판정이 참일 때만 플러그인을 동적 import 하는 것이 이 프로젝트의 네이티브 연동 규약이다
 * (`navigation/useHardwareBack.ts`, `lib/shareCardDelivery.ts`).
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  isNative?: boolean
}

export function isNativeShell(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  // native-bridge.js가 isNativePlatform을 정의한다. isNative는 구버전 대비 폴백.
  return cap?.isNativePlatform?.() === true || cap?.isNative === true
}
