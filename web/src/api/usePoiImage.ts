import { useEffect, useState } from 'react'
import { fetchPoiImageResultCached } from './details'

/**
 * POI 대표 이미지 URL을 결과 표시 시점에 실시간 조회 (세션 메모리 캐시 경유).
 * 로딩 중·이미지 없음·실패는 모두 null → 호출부에서 방위색 폴백을 그대로 노출한다.
 */
export function usePoiImage(
  contentId: string,
  enabled = true,
  variant: 'full' | 'thumb' = 'full',
): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    setUrl(null)
    if (!enabled) return () => {
      cancelled = true
    }
    const load = (canRetry: boolean) => {
      fetchPoiImageResultCached(contentId, variant).then((result) => {
        if (cancelled) return
        setUrl(result.status === 'ready' ? result.url : null)
        // 사진 없음은 확정 결과다. 조회에 실패한 경우에만 한 번 재시도한다.
        if (result.status === 'error' && canRetry) retryTimer = setTimeout(() => load(false), 1_000)
      })
    }
    load(true)
    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [contentId, enabled, variant])
  return url
}
