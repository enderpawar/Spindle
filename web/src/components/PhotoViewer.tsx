import { useEffect, useRef, useState } from 'react'
import { SourceLine } from './SourceLine'
import './PhotoViewerArrows.css'

function ViewerImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? <div className="photo-viewer-empty" role="status">
    <span>사진을 불러오지 못했어요</span>
    <button type="button" onClick={() => setFailed(false)}>다시 시도</button>
  </div> : <img src={src} alt={name} draggable={false} onError={() => setFailed(true)} />
}

export function PhotoViewer({ name, district, src, images, count, index, loading, onMove, onClose }: {
  name: string; district: string; src?: string; images: readonly string[]; count: number; index: number; loading: boolean
  onMove: (delta: number) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ id: number; x: number; y: number; at: number; horizontal: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const moving = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const moveCallback = useRef(onMove)
  moveCallback.current = onMove
  const previousImage = images[(index - 1 + count) % count]
  const nextImage = images[(index + 1) % count]

  const settle = (delta: number) => {
    if (moving.current || count < 2) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setOffset(0); if (delta) onMove(delta); return }
    moving.current = true
    setAnimating(true)
    setOffset(-delta * (stage.current?.clientWidth ?? 0))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (delta) moveCallback.current(delta)
      setAnimating(false)
      setOffset(0)
      moving.current = false
    }, 240)
  }
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer.current)
      node?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={dialog} className="photo-viewer motion-dialog" aria-labelledby="photo-viewer-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}
    onKeyDown={event => {
      if (count < 2) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); settle(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
    <header className="photo-viewer-header">
      <div><span>{district} · 사진</span><h2 id="photo-viewer-title">{name}</h2></div>
      <button type="button" aria-label="사진 닫기" onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <div ref={stage} className="photo-viewer-stage" onPointerDown={event => {
      if (!event.isPrimary) { pointer.current = null; setOffset(0); return }
      if (count < 2 || moving.current || event.button !== 0 || (event.target as HTMLElement).closest('button')) return
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), horizontal: false }
    }} onPointerMove={event => {
      const start = pointer.current
      if (!start || start.id !== event.pointerId || moving.current) return
      const dx = event.clientX - start.x, dy = event.clientY - start.y
      if (!start.horizontal) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { pointer.current = null; return }
        if (Math.abs(dx) < 8) return
        start.horizontal = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      const width = event.currentTarget.clientWidth
      setOffset(Math.max(-width, Math.min(width, dx)))
    }} onPointerCancel={() => { pointer.current = null; settle(0) }} onPointerUp={event => {
      const start = pointer.current; pointer.current = null
      if (!start || !start.horizontal || start.id !== event.pointerId) return
      const dx = event.clientX - start.x
      const fast = Math.abs(dx) > 24 && Math.abs(dx) / Math.max(1, performance.now() - start.at) > .45
      settle(Math.abs(dx) > event.currentTarget.clientWidth * .18 || fast ? (dx < 0 ? 1 : -1) : 0)
    }}>
      <div className={`photo-viewer-track${animating ? ' is-settling' : ''}`} style={{ transform: `translate3d(${offset}px, 0, 0)` }}>
        {count > 1 && previousImage && <div className="photo-viewer-slide photo-viewer-slide--previous" aria-hidden="true" inert><ViewerImage key={previousImage} src={previousImage} name="" /></div>}
        <div className="photo-viewer-slide photo-viewer-slide--current">
          {src ? <ViewerImage key={src} src={src} name={name} /> : <div className="photo-viewer-empty" role="status">{loading ? '사진을 불러오는 중이에요' : '등록된 사진이 없어요'}</div>}
        </div>
        {count > 1 && nextImage && <div className="photo-viewer-slide photo-viewer-slide--next" aria-hidden="true" inert><ViewerImage key={nextImage} src={nextImage} name="" /></div>}
      </div>
    </div>
    <footer className="photo-viewer-footer">
      <button className="photo-viewer-nav-btn" type="button" disabled={count < 2} onClick={() => settle(-1)} aria-label="이전 사진">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <span role="status" aria-live="polite">{loading ? '사진 불러오는 중' : count ? `${index + 1} / ${count}` : src ? '대표 사진' : '사진 없음'}</span>
      <button className="photo-viewer-nav-btn" type="button" disabled={count < 2} onClick={() => settle(1)} aria-label="다음 사진">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </button>
    </footer>
    <SourceLine style={{ margin: '0 0 14px', fontSize: 10 }} />
  </dialog>
}
