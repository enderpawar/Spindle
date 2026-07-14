import { useEffect } from 'react'
import excitedImg from '../assets/poses/별이_wink.png'
import { PoiPhoto } from '../components/PoiPhoto'
import { ScreenFrame } from '../components/ScreenFrame'
import type { Recommendation } from '../mock/pois'

/** S3 방위 연출 — 자동으로 결과 카드로 넘어가고, 탭하면 즉시 스킵 (ui.md) */
export function RevealScreen({ rec, onOpen }: { rec: Recommendation; onOpen: () => void }) {
  const { direction } = rec
  const previewPoi = rec.candidates[0]

  useEffect(() => {
    const timer = setTimeout(onOpen, 3000)
    return () => clearTimeout(timer)
  }, [onOpen])

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <button onClick={onOpen} aria-label="바로 열어보기" style={{ position: 'absolute', inset: 0, border: 'none', background: 'none', cursor: 'pointer', zIndex: 1 }} />

      <div className="reveal-layout fade-up">
        <div className="reveal-copy">
          <h1>{direction.message}</h1>
          {rec.expandReason && (
            <p className="reveal-expand-reason">{rec.expandReason}</p>
          )}
        </div>

        <div className="reveal-card-shell">
          <div className="reveal-card-glow" aria-hidden style={{ background: `radial-gradient(circle, ${direction.color}55, transparent 68%)` }} />
          <article className="reveal-card motion-reveal-card" style={{ background: `linear-gradient(155deg, #ffffff 0%, #f8fbff 58%, ${direction.color}2e 100%)`, borderColor: `${direction.color}66` }}>
            <div className="reveal-card-orbit" aria-hidden style={{ borderColor: `${direction.color}38` }} />
            <div className="reveal-card-head">
              <span>SPINDLE PICK</span>
            </div>

            <div className="reveal-card-visual">
              <div className="reveal-photo-frame" style={{ background: `linear-gradient(145deg, ${direction.color}66, #e8f0ff)` }}>
                <img className="reveal-photo-fallback" src="/brand-mark-192.png" alt="" aria-hidden />
                {previewPoi && <PoiPhoto contentId={previewPoi.contentId} alt={`${previewPoi.name} 미리보기`} scrim />}
              </div>
              <div className="reveal-mascot-bubble">여기 어때요?</div>
              <img className="reveal-card-mascot" src={excitedImg} alt="" />
            </div>

            <div className="reveal-card-copy">
              <div className="reveal-card-kicker">숨은 장소를 찾았어요</div>
              <div className="reveal-card-title">오늘의 방향에서 만날 곳</div>
              <div className="reveal-card-cta">
                <span>탭해서 먼저 보기</span>
                <span aria-hidden>→</span>
              </div>
            </div>
            <div className="reveal-progress" aria-hidden><span style={{ background: direction.color }} /></div>
          </article>
        </div>

        <div className="reveal-auto-hint">3초 후 자동으로 열려요</div>
      </div>
    </ScreenFrame>
  )
}
