/**
 * 웹(PWA·브라우저) 빌드 전용 스텁 — `vite.config.ts`가 `@capacitor/filesystem`을 이걸로 바꿔 끼운다.
 * `capacitorShareStub.ts`와 짝이다. 웹에는 파일시스템 접근 경로 자체가 없다.
 */
export const Directory = {
  Cache: 'CACHE',
} as const

export const Filesystem = {
  writeFile(_options: unknown): Promise<{ uri: string }> {
    return Promise.reject(new Error('파일 저장은 앱에서만 사용합니다'))
  },
  deleteFile(_options: unknown): Promise<void> {
    return Promise.resolve()
  },
}
