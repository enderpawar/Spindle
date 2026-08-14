import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { API_NETWORK_ONLY_CACHE_NAME } from './src/pwa/cachePolicy.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * 앱(Capacitor) 빌드 여부. `vite build --mode app`으로 켠다 (루트 `npm run app:build`).
   * 네이티브 앱은 웹 자산이 이미 번들돼 있어 service worker가 캐시 꼬임만 만든다.
   * 웹 배포(Cloudflare Pages)는 기존대로 PWA를 유지하므로 `npm run pwa:verify`도 그대로 통과한다.
   */
  const isAppBuild = mode === 'app'

  return {
  plugins: [
    react(),
    ...(isAppBuild ? [] : [VitePWA({
      registerType: 'autoUpdate', // 심사 기간 중 구버전 방지 (pwa 스킬)
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'apple-touch-icon-180.png', 'brand-mark-192.png', 'stamp-mark-512.png', 'pwa-icon-192.png', 'pwa-icon-512.png'],
      workbox: {
        // pwa 스킬 규약: precache는 정적 자산만. API 응답은 NetworkOnly로만
        // 통과시키고 Cache Storage에 넣지 않는다.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\//,
            handler: 'NetworkOnly',
            method: 'GET',
            options: {
              cacheName: API_NETWORK_ONLY_CACHE_NAME,
            },
          },
        ],
      },
      manifest: {
        name: 'Spindle',
        short_name: 'Spindle',
        description: '휴대폰을 돌려 가리키는 방향의 숨은 부산을 발견하는 스핀 탐색 서비스',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F2540',
        background_color: '#0F2540',
        categories: ['travel', 'entertainment'],
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    })]),
  ],
  resolve: isAppBuild
    ? {
        // VitePWA를 끄면 가상 모듈이 사라지므로 no-op 스텁으로 대체한다.
        alias: {
          'virtual:pwa-register': fileURLToPath(new URL('./src/pwa/virtualPwaRegisterStub.ts', import.meta.url)),
        },
      }
    : {},
  server: {
    // 로컬 개발: /api → wrangler dev (proxy/) — 클라이언트는 TourAPI를 직접 호출하지 않는다
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        poiCheck: fileURLToPath(new URL('./poi-check.html', import.meta.url)), // Phase 1 검증 페이지
        sensorCheck: fileURLToPath(new URL('./sensor-check.html', import.meta.url)),
      },
    },
  },
  }
})
