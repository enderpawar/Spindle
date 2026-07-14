import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'
import App from './App.tsx'
import { registerSpindlePwa } from './pwa/register'

registerSpindlePwa()

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
    <App />
  </StrictMode>,
)
