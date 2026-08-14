import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 네이티브 셸 설정 (Android 우선, iOS는 `npx cap add ios`로 증분 추가).
 *
 * ⚠ `server.url`을 절대 설정하지 않는다. 원격 URL을 로드하면 App Store 심사에서
 * "웹사이트를 감싼 앱"(가이드라인 4.2) + 원격 코드 로드(2.5.2) 복합 리젝 사유가 된다.
 * 웹 자산은 항상 `webDir`로 번들해 로컬에서 로드한다.
 *
 * 앱 오리진은 iOS `capacitor://localhost`, Android `https://localhost`가 되므로
 * 프록시(`proxy/src/index.ts`)의 CORS 허용 목록에 두 오리진이 포함돼야 한다.
 */
const config: CapacitorConfig = {
  appId: 'kr.spindle.app',
  appName: 'Spindle',
  webDir: 'dist',
}

export default config
