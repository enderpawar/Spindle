import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'
import './mobile-pwa.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { registerSpindlePwa } from './pwa/register'
import { isNativeShell } from './native/shell'

registerSpindlePwa()

// 설치형 PWA와 네이티브 셸은 레이아웃 뷰포트 보고가 달라 앱 프레임 보정이 서로 다르다
// (mobile-pwa.css의 #root). CSS에서 두 환경을 가릴 방법이 없으므로 여기서 표시만 해 둔다.
// native-bridge.js가 페이지 스크립트보다 먼저 window.Capacitor를 주입하므로 이 시점에 판정된다.
if (isNativeShell()) {
  document.documentElement.classList.add('is-native-shell')

  // 카카오 JS SDK는 Referer로 도메인 제한을 검사하는데, 커스텀 스킴 오리진을 파싱하지
  // 못한다. iOS 앱(capacitor://localhost)에서 보낸 요청을 `caller=capacitor:` 로 읽고
  // {"errorType":"AccessDeniedError","message":"domain mismatched!"} 401로 거절한다.
  // 콘솔에 capacitor://localhost 를 등록해도 비교할 문자열 자체가 만들어지지 않아
  // 통과할 수 없다(실제 응답으로 확인). Referer가 없으면 200으로 내려주므로 네이티브
  // 셸에서만 전송을 끈다.
  //
  // 스크립트 태그 하나가 아니라 문서 정책으로 두는 이유: SDK가 로드된 뒤 타일·리소스를
  // 추가로 받아오는데 그 요청들도 같은 검사를 받는다.
  //
  // 프록시는 Origin으로 CORS를 판정하므로(proxy/src/index.ts의 APP_SHELL_ORIGINS)
  // 영향이 없고, 웹·PWA 빌드는 이 분기를 타지 않아 도메인 제한이 그대로 유지된다.
  const referrerPolicy = document.createElement('meta')
  referrerPolicy.name = 'referrer'
  referrerPolicy.content = 'no-referrer'
  document.head.appendChild(referrerPolicy)
}

const removedEntryPath = `/${['travel', 'html'].join('.')}`
if (window.location.pathname === removedEntryPath) {
  window.history.replaceState(null, '', `/${window.location.search}${window.location.hash}`)
}
if ('caches' in window) {
  void caches
    .keys()
    .then((keys) => Promise.all(keys.map((key) => caches.open(key).then((cache) => cache.delete(removedEntryPath)))))
    .catch(() => {
      // Best-effort cleanup for stale static shells from earlier builds.
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
