/**
 * 웹(PWA·브라우저) 빌드 전용 스텁 — `vite.config.ts`가 `@capacitor/share`를 이걸로 바꿔 끼운다.
 * `navigation/capacitorAppStub.ts`와 같은 장치이며 이유도 같다: 브라우저에서는 도달할 수 없는
 * 코드인데 실물을 두면 별도 청크로 남아 service worker가 precache 한다.
 */
export const Share = {
  share(_options: unknown): Promise<{ activityType?: string }> {
    // 여기 닿았다면 네이티브 판정이 새어 나온 것이다. 웹은 navigator.share 경로를 쓴다.
    return Promise.reject(new Error('공유 시트는 앱에서만 사용합니다'))
  },
  canShare(): Promise<{ value: boolean }> {
    return Promise.resolve({ value: false })
  },
}
