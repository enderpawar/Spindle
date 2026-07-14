import { useEffect, useState } from 'react'
import { fetchPoiImageCached } from './details'

/**
 * POI 대표 이미지 URL을 결과 표시 시점에 실시간 조회 (세션 메모리 캐시 경유).
 * 로딩 중·이미지 없음·실패는 모두 null → 호출부에서 방위색 폴백을 그대로 노출한다.
 */
export function usePoiImage(contentId: string, enabled = true): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!enabled) return () => {
      cancelled = true
    }
    fetchPoiImageCached(contentId).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [contentId, enabled])
  return url
}
