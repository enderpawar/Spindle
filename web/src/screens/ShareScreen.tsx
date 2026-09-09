import { useEffect, useState } from 'react'
import { fetchPoiCardDetailCached, poiImageProxyUrl } from '../api/details'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { buildShareCardBlob } from '../lib/shareCard'
import { canUseNativeShareSheet, shareCardViaNativeSheet } from '../lib/shareCardDelivery'
import type { Poi, Recommendation } from '../mock/pois'
import './ShareScreen.css'

interface Props { rec: Recommendation; poi: Poi; onBack: () => void }

/** 미리 본 PNG를 그대로 전달한다. 생성 결과는 화면의 메모리에만 보관한다. */
export function ShareScreen({ rec, poi, onBack }: Props) {
  const { direction } = rec
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [card, setCard] = useState<{ key: string; blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const isApp = canUseNativeShareSheet()
  const canShare = isApp || typeof navigator.share === 'function'
  const districtLine = `부산 ${poi.district} · 걸어서 약 ${poi.walkMinutes}분`
  const cardKey = JSON.stringify([poi.contentId, poi.name, districtLine, direction.label, direction.message, direction.color])
  const readyCard = card?.key === cardKey ? card : null

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | undefined
    setCard(null)
    setFailed(false)
    setNotice(null)
    async function prepare() {
      const detail = await fetchPoiCardDetailCached(poi.contentId).catch(() => null)
      if (cancelled) return
      const blob = await buildShareCardBlob({
        poiName: poi.name, districtLine, message: direction.message,
        color: direction.color,
        imageUrl: detail?.imageUrl ? poiImageProxyUrl(poi.contentId) : undefined,
      })
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setCard({ key: cardKey, blob, url: objectUrl })
    }
    void prepare().catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cardKey, poi.contentId, poi.name, districtLine, direction.message, direction.color, attempt])

  const handleSave = () => {
    if (!readyCard) return
    const a = document.createElement('a')
    a.href = readyCard.url
    a.download = `spindle-${direction.id.toLowerCase()}-${poi.id}.png`
    a.click()
    setNotice('카드 이미지를 다운로드했어요')
  }
  const handleShare = async () => {
    if (!readyCard) return
    setBusy(true)
    setNotice(null)
    const text = `오늘의 방향은 ${direction.label}쪽 — ${poi.name}`
    try {
      if (isApp) {
        const result = await shareCardViaNativeSheet({ blob: readyCard.blob, title: 'Spindle', text })
        if (result === 'failed') setNotice('공유 시트를 열지 못했어요. 다시 시도해 주세요')
      } else {
        const file = new File([readyCard.blob], 'spindle.png', { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Spindle', text })
        } else {
          await navigator.share({ title: 'Spindle', text })
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setNotice('공유하지 못했어요. 다시 시도해 주세요')
      }
    } finally { setBusy(false) }
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)', color: 'var(--l-ink)', overflowY: 'auto' }}>
      <header className="share-header">
        <button onClick={onBack} aria-label="뒤로" className="btn btn-ghost share-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <h1>오늘의 방향, 간직하기</h1>
      </header>
      <div className="share-preview-area fade-up">
        <div className="share-preview" aria-busy={!readyCard && !failed}>
          {readyCard ? (
            <img src={readyCard.url} alt={`${poi.name} 여행 카드. ${direction.label}쪽. ${direction.message}. ${districtLine}. 출처: ⓒ한국관광공사`} />
          ) : (
            <div className="share-preview-status" role="status">
              <span>{failed ? '카드를 만들지 못했어요' : '오늘의 여행을 카드에 담고 있어요'}</span>
              {failed && <button className="btn btn-ghost" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>}
            </div>
          )}
        </div>
        <p className="share-caption">한 번의 스핀이 데려다준 곳</p>
      </div>
      <div className="share-actions">
        <SourceLine style={{ margin: 0, color: 'var(--l-ink-3)' }} />
        {notice && <p className="share-notice" role="status">{notice}</p>}
        {canShare && (
          <button className="btn btn-primary" onClick={handleShare} disabled={!readyCard || busy}>
            {busy ? '공유하는 중…' : '공유하기'}
          </button>
        )}
        {isApp ? (
          <p className="share-notice">공유할 앱을 고르면 카드 이미지가 그대로 전달돼요</p>
        ) : (
          <button className={`btn ${canShare ? 'btn-ghost' : 'btn-primary'}`} onClick={handleSave} disabled={!readyCard || busy}>
            이미지로 저장
          </button>
        )}
      </div>
    </ScreenFrame>
  )
}
