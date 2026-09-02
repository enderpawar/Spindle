import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { API_NETWORK_ONLY_CACHE_NAME } from './src/pwa/cachePolicy.ts'

function buildAlias(isAppBuild: boolean): Record<string, string> {
  return isAppBuild
    ? { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwa/virtualPwaRegisterStub.ts', import.meta.url)) }
    : {
        '@capacitor/app': fileURLToPath(new URL('./src/navigation/capacitorAppStub.ts', import.meta.url)),
        '@capacitor/share': fileURLToPath(new URL('./src/lib/capacitorShareStub.ts', import.meta.url)),
        '@capacitor/filesystem': fileURLToPath(new URL('./src/lib/capacitorFilesystemStub.ts', import.meta.url)),
      }
}

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
    /**
     * 앱 빌드에만 Referer 전송을 끈다.
     *
     * 카카오는 Referer로 도메인 제한을 검사하는데 커스텀 스킴의 호스트를 파싱하지 못한다.
     * iOS 앱(capacitor://localhost)의 요청을 `caller=capacitor:` 로 읽고 401로 거절하며,
     * 콘솔에 capacitor://localhost 를 등록해도 비교할 문자열이 만들어지지 않아 통과할 수 없다.
     * Referer가 없으면 200으로 내려준다(카카오 서버 응답으로 확인).
     *
     * 반드시 **파싱 시점에 있는 정적 meta**여야 한다. JS로 head에 삽입하는 방식은 실기기에서
     * 무시되는 것을 확인했다(빌드 3). 그리고 SDK script 요소에 referrerPolicy를 주는 것만으로도
     * 부족하다 — autoload=false 라서 maps.load()가 지도 라이브러리를 다시 받아오는데, 그 요청은
     * SDK 내부가 만들어 문서 정책을 따르기 때문이다. 빌드 4에서 부트스트랩은 통과했지만
     * maps.load() 콜백이 오지 않아 10초 타임아웃으로 실패했다.
     *
     * 웹·PWA 빌드는 이 분기를 타지 않으므로 도메인 제한이 그대로 유지된다.
     */
    ...(isAppBuild
      ? [
          {
            name: 'spindle-app-no-referrer',
            transformIndexHtml: () => [
              {
                tag: 'meta',
                attrs: { name: 'referrer', content: 'no-referrer' },
                injectTo: 'head-prepend' as const,
              },
            ],
          },
        ]
      : []),
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
  // 빌드 대상에 없는 모듈은 서로 반대 방향으로 no-op 스텁을 물린다.
  //  - 앱 빌드: VitePWA를 끄면 `virtual:pwa-register` 가상 모듈이 사라진다.
  //  - 웹 빌드: 하드웨어 뒤로가기·네이티브 공유 시트 플러그인은 브라우저에서 아무 일도
  //    못 하는데, 두면 별도 청크로 남아 service worker가 precache 한다.
  resolve: { alias: buildAlias(isAppBuild) },
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
