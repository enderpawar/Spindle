import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePoiImage } from '../api/usePoiImage'
import { fetchPoiImageFallback } from '../api/details'
import { loadImageWithRetry } from '../api/imageRetry'

interface Props {
  contentId: string
  alt: string
  /** 하단 스크림 — 이미지 위에 방위 칩·이름을 얹는 카드에서 가독성 확보 */
  scrim?: boolean
  variant?: 'full' | 'thumb'
  style?: CSSProperties
}

/**
 * 방위색 그라디언트 플레이스홀더 위에 얹는 TourAPI 대표 이미지 오버레이.
 * 부모는 position:relative + overflow:hidden 이어야 한다. 이미지가 없거나 로딩/실패면
 * 아무것도 렌더하지 않아 부모의 폴백 아트가 그대로 보인다 (배지 등은 이 뒤에 그린다).
 */
export function PoiPhoto(props: Props) {
  return <PoiPhotoContent key={`${props.contentId}:${props.variant ?? 'full'}`} {...props} />
}

function PoiPhotoContent({ contentId, alt, scrim = false, variant = 'full', style }: Props) {
  const markerRef = useRef<HTMLSpanElement | null>(null)
  const [active, setActive] = useState(false)
  const primaryUrl = usePoiImage(contentId, active, variant)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const url = fallbackUrl ?? primaryUrl
  const failed = url !== null && failedUrls.includes(url)
  const loaded = url !== null && loadedUrl === url

  useEffect(() => {
    // 원본·다른 사진을 최대 세 번 시도해 무한 요청을 막는다.
    if (failedUrls.length === 0 || failedUrls.length > 3) return
    return loadImageWithRetry(
      () => fetchPoiImageFallback(contentId, failedUrls, variant),
      setFallbackUrl,
    )
  }, [contentId, failedUrls, variant])

  useEffect(() => {
    if (active) return
    const marker = markerRef.current
    if (!marker) return
    if (!('IntersectionObserver' in window)) {
      setActive(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setActive(true)
        observer.disconnect()
      },
      { rootMargin: '180px' },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [active, contentId])

  return (
    <>
      <span ref={markerRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {url && !failed && (
        <img
          key={url}
          src={url}
          alt={alt}
          loading="eager"
          decoding="async"
          onError={() => setFailedUrls((previous) => previous.includes(url) ? previous : [...previous, url])}
          onLoad={() => setLoadedUrl(url)}
          className={`poi-photo${loaded ? ' is-loaded' : ''}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }}
        />
      )}
      {url && !failed && scrim && (
        <div
          className={`poi-photo-scrim${loaded ? ' is-loaded' : ''}`}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,.06) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,.42) 100%)',
          }}
        />
      )}
    </>
  )
}
