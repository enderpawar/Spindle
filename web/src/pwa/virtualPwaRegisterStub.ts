/**
 * 앱(Capacitor) 빌드 전용 스텁.
 *
 * 앱 빌드에서는 `vite.config.ts`가 VitePWA 플러그인을 끄기 때문에 가상 모듈
 * `virtual:pwa-register`가 존재하지 않아 번들이 깨진다. 이 파일을 alias로 물려
 * `registerSpindlePwa()`가 아무 일도 하지 않도록 만든다.
 *
 * 네이티브 앱은 웹 자산이 이미 번들돼 있어 service worker가 필요 없다.
 * 웹 배포는 이 스텁을 쓰지 않고 실제 가상 모듈을 그대로 사용한다.
 */

interface RegisterSWOptions {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  onRegisterError?: (error: unknown) => void
}

export function registerSW(_options: RegisterSWOptions = {}): (reloadPage?: boolean) => Promise<void> {
  return async () => {}
}
