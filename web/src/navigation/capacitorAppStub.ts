/**
 * 웹(PWA·브라우저) 빌드 전용 스텁 — `vite.config.ts`가 `@capacitor/app`을 이걸로 바꿔 끼운다.
 *
 * `useHardwareBack`은 네이티브 판정 뒤에서만 `@capacitor/app`을 동적 import 하므로
 * 브라우저에서 실행되는 일은 없다. 그런데도 실물을 두면 별도 청크로 빌드 산출물에 남고,
 * **service worker가 그 청크까지 precache** 한다 — 브라우저에서 아무 일도 못 하는 코드를
 * PWA 설치 때 내려받아 Cache Storage에 넣는 셈이다.
 *
 * 앱 빌드(`--mode app`)에서는 이 alias가 걸리지 않고 진짜 플러그인이 들어간다.
 * `src/pwa/virtualPwaRegisterStub.ts`와 정확히 반대 방향의 같은 장치다.
 */
interface PluginListenerHandle {
  remove: () => Promise<void>
}

export const App = {
  addListener(_eventName: string, _listener: () => void): Promise<PluginListenerHandle> {
    // 여기 닿았다면 네이티브 판정이 새어 나온 것이다. 조용히 아무것도 하지 않는다.
    return Promise.resolve({ remove: () => Promise.resolve() })
  },
  exitApp(): Promise<void> {
    return Promise.resolve()
  },
}
