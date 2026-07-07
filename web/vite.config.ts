import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 심사 기간 중 구버전 방지 (pwa 스킬 — Phase 6에서 리로드 토스트 추가)
      workbox: {
        // pwa 스킬 규약: precache는 정적 자산만, API 경로는 SW가 절대 다루지 않는다
        // (runtimeCaching 미정의 = /api 요청은 network-only로 통과)
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Spindle',
        short_name: 'Spindle',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1220', // TODO(ui.md): 확정 테마 컬러로 교체 (Phase 6)
        background_color: '#0b1220',
        icons: [], // TODO(Phase 6): 512px 마스커블 아이콘 추가
      },
    }),
  ],
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
      },
    },
  },
})
