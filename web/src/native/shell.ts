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
  getPlatform?: () => string
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
}

export function isNativeShell(): boolean {
  const cap = capacitor()
  // native-bridge.js가 isNativePlatform을 정의한다. isNative는 구버전 대비 폴백.
  return cap?.isNativePlatform?.() === true || cap?.isNative === true
}

/**
 * 어느 네이티브 셸인가 — `'android'` | `'ios'`, 웹이면 `null`.
 *
 * **플러그인마다 설치된 플랫폼이 다르므로 판정을 셸 유무로만 하면 안 된다.** 예를 들어
 * `@capacitor/share`는 안드로이드 프로젝트에만 물려 있고 iOS SPM 매니페스트
 * (`ios/App/CapApp-SPM/Package.swift`)에는 `CapacitorApp`만 선언돼 있다. iOS에서
 * `isNativeShell()`만 보고 네이티브 경로로 보내면 플러그인 프록시가 "not implemented"로
 * 거절해 기능이 통째로 죽는다. 플랫폼별로 갈라야 하는 곳은 이 함수를 쓴다.
 */
export function nativePlatform(): 'android' | 'ios' | null {
  if (!isNativeShell()) return null
  const platform = capacitor()?.getPlatform?.()
  return platform === 'android' || platform === 'ios' ? platform : null
}
