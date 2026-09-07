/** 사진 없음(null)은 확정 결과다. 조회 오류만 한 번 재시도하고 화면 정리 시 중단한다. */
export function loadImageWithRetry(
  request: () => Promise<string | null>,
  onResult: (url: string | null) => void,
): () => void {
  let cancelled = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const load = (canRetry: boolean) => {
    request().then((url) => {
      if (!cancelled) onResult(url)
    }).catch(() => {
      if (cancelled) return
      if (canRetry) retryTimer = setTimeout(() => load(false), 1_000)
      else onResult(null)
    })
  }
  load(true)
  return () => {
    cancelled = true
    clearTimeout(retryTimer)
  }
}
