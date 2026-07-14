import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePoiImage } from '../api/usePoiImage'

interface Props {
  contentId: string
  alt: string
  /** 하단 스크림 — 이미지 위에 방위 칩·이름을 얹는 카드에서 가독성 확보 */
  scrim?: boolean
  style?: CSSProperties
}

/**
 * 방위색 그라디언트 플레이스홀더 위에 얹는 TourAPI 대표 이미지 오버레이.
 * 부모는 position:relative + overflow:hidden 이어야 한다. 이미지가 없거나 로딩/실패면
 * 아무것도 렌더하지 않아 부모의 폴백 아트가 그대로 보인다 (배지 등은 이 뒤에 그린다).
 */
export function PoiPhoto({ contentId, alt, scrim = false, style }: Props) {
  const markerRef = useRef<HTMLSpanElement | null>(null)
  const [active, setActive] = useState(false)
  const url = usePoiImage(contentId, active)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
    if (active) return
    const marker = markerRef.current
    if (!marker) return
    if (!('IntersectionObserver' in window)) {
      const timer = setTimeout(() => setActive(true), 900)
      return () => clearTimeout(timer)
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
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
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
