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
