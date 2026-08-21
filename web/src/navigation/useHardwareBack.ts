import { useEffect, useRef } from 'react'

/**
 * 안드로이드 하드웨어 뒤로가기를 앱이 직접 처리한다.
 *
 * 웹(브라우저·PWA)에서는 아무것도 하지 않는다 — 심사 제출 URL의 동선을 바꾸지 않기 위해서다.
 * 그래서 `@capacitor/core`조차 정적으로 import하지 않는다. 브라우저에서는 어차피 아무 일도
 * 못 하는 코드인데 웹 번들이 7.5KB(gzip 2.8KB) 무거워진다. 판정은 네이티브 브리지가
 * 페이지 스크립트보다 먼저 주입하는 `window.Capacitor`로 하고, 플러그인은 그 뒤에서
 * 동적 import 한다 — 웹은 이 청크를 내려받지도, 평가하지도 않는다.
 *
 * ⚠ 리스너를 등록하면 뒤로가기 처리 전체가 우리에게 넘어온다. `@capacitor/app` 8.x의
 * `AppPlugin.handleOnBackPressed()`는 JS 리스너가 있으면 `backButton` 이벤트만 던지고
 * `webView.goBack()`도 액티비티 종료도 하지 않는다(설치본 소스 확인). 리스너가 없으면
 * 그대로 액티비티가 finish 돼 앱이 꺼진다 — 지금 결과 카드에서 앱이 죽는 원인이다.
 * 따라서 **앱 종료는 호출부가 `exitApp()`으로 명시해야 한다.**
 *
 * ⚠ 이 앱은 `history.pushState`를 쓰지 않는다. WebView 히스토리가 쌓이기 시작하면
 * 뒤로가기가 이중으로 처리되므로, 도입하려면 이 파일부터 다시 봐야 한다.
 *
 * 이벤트는 `retainUntilConsumed`로 전달되므로, 등록 전에 누른 뒤로가기는 등록 직후 재생된다.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  isNative?: boolean
}

/** 네이티브 셸 안에서 실행 중인가. 브라우저에는 이 전역이 없다. */
function isNativeShell(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  // native-bridge.js가 isNativePlatform을 정의한다. isNative는 구버전 대비 폴백.
  return cap?.isNativePlatform?.() === true || cap?.isNative === true
}

export function useHardwareBack(handler: () => void): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!isNativeShell()) return

    // addListener가 Promise라서, StrictMode 이중 마운트에서 늦게 도착한 핸들이
    // 그대로 남지 않도록 취소 플래그로 정리한다.
    let cancelled = false
    let remove: (() => void) | undefined

    void import('@capacitor/app')
      .then(({ App }) => App.addListener('backButton', () => handlerRef.current()))
      .then((handle) => {
        if (cancelled) void handle.remove()
        else remove = () => void handle.remove()
      })
      .catch((error: unknown) => {
        // 등록 실패는 기본 동작(즉시 종료)으로 되돌아갈 뿐이라 앱을 막지 않는다.
        console.warn('[Spindle] 뒤로가기 리스너를 등록하지 못했습니다.', error)
      })

    return () => {
      cancelled = true
      remove?.()
    }
  }, [])
}

/** 앱 종료 — 네이티브에서만 의미가 있고 웹에서는 아무 일도 하지 않는다. */
export async function exitApp(): Promise<void> {
  if (!isNativeShell()) return
  const { App } = await import('@capacitor/app')
  await App.exitApp()
}
