import { useEffect, useState } from 'react'
import { fetchPoiCardDetailCached, poiImageProxyUrl } from '../api/details'
import { ScreenFrame, Stars } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { canUseNativeShareSheet, shareCardViaNativeSheet } from '../lib/shareCardDelivery'
import type { Poi, Recommendation } from '../mock/pois'

interface Props {
  rec: Recommendation
  poi: Poi
  onBack: () => void
}

type BusyState = 'idle' | 'saving' | 'sharing'

/**
 * S5 공유 카드 — 웹은 Web Share API + 다운로드 폴백, 앱은 안드로이드 공유 시트.
 *
 * 앱에서는 `navigator.share`도 `<a download>`도 동작하지 않아 카드를 밖으로 내보낼 수 없었다
 * (이유는 `lib/shareCardDelivery.ts` 주석). 그래서 앱에서는 버튼을 하나로 합치고 공유 시트에
 * PNG 파일을 넘긴다 — 저장도 시트의 사진·파일 대상이 처리한다.
 */
export function ShareScreen({ rec, poi, onBack }: Props) {
  const { direction } = rec
  const [busy, setBusy] = useState<BusyState>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const isApp = canUseNativeShareSheet()
  const canShare = isApp || typeof navigator.share === 'function'

  // 결과 카드에서 이미 조회한 상세(세션 캐시 히트)로 대표 이미지 유무를 확인한다.
  // 미리보기 <img>는 직접 URL로 표시하고, 내려받는 PNG(canvas)는 CORS 회피용 프록시 URL을 쓴다.
  useEffect(() => {
    let cancelled = false
    setImageUrl(null)
    setPreviewFailed(false)
    fetchPoiCardDetailCached(poi.contentId)
      .then((d) => {
        if (!cancelled) setImageUrl(d.imageUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [poi.contentId])

  const showImage = Boolean(imageUrl) && !previewFailed

  const shareText = `오늘의 방향은 ${direction.label}쪽 — ${poi.name}`
  // 웹 다운로드 전용 파일명. 앱 공유는 캐시 사본을 한 장으로 묶기 위해 고정 이름을 쓴다
  // (`lib/shareCardDelivery.ts`의 SHARE_CARD_PATH 주석 참고).
  const cardFileName = `spindle-${direction.id.toLowerCase()}-${poi.id}.png`

  // 카드 그리기(1080×1920 Canvas)는 저장·공유를 누른 뒤에야 필요하다 — 화면을 여는 데는
  // 쓰이지 않으므로 초기 번들에서 빼고 이 시점에 받는다.
  const makeBlob = async () => {
    const { buildShareCardBlob } = await import('../lib/shareCard')
    return buildShareCardBlob({
      poiName: poi.name,
      districtLine: `부산 ${poi.district} · 걸어서 약 ${poi.walkMinutes}분`,
      message: direction.message,
      directionLabel: direction.label,
      color: direction.color,
      // 대표 이미지가 있을 때만 프록시 경유 same-origin URL을 넘긴다 (없으면 별 폴백)
      imageUrl: showImage ? poiImageProxyUrl(poi.contentId) : undefined,
    })
  }

  const handleSave = async () => {
    setBusy('saving')
    setNotice(null)
    try {
      const blob = await makeBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cardFileName
      a.click()
      URL.revokeObjectURL(url)
      setNotice('갤러리(다운로드)에 저장했어요')
    } catch {
      setNotice('저장에 실패했어요. 다시 시도해 주세요')
    } finally {
      setBusy('idle')
    }
  }

  const handleShare = async () => {
    setBusy('sharing')
    setNotice(null)
    try {
      const blob = await makeBlob()
      if (isApp) {
        const result = await shareCardViaNativeSheet({ blob, title: 'Spindle', text: shareText })
        // 시트를 그냥 닫은 것은 실패가 아니다 — 문구를 띄우지 않는다.
        if (result === 'failed') setNotice('공유 시트를 열지 못했어요. 다시 시도해 주세요')
        return
      }
      const file = new File([blob], 'spindle.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Spindle', text: shareText })
      } else {
        await navigator.share({ title: 'Spindle', text: shareText })
      }
    } catch {
      // 사용자가 공유 시트를 닫은 경우 포함 — 조용히 무시
    } finally {
      setBusy('idle')
    }
  }

  return (
    <ScreenFrame>
      <Stars />
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 0', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="btn btn-ghost" style={{ width: 44, height: 44, borderRadius: '50%', padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>오늘의 방향, 자랑하기</span>
      </header>

      {/* 카드 미리보기 (실제 PNG와 같은 구성) */}
      <div className="fade-up" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '18px 0', zIndex: 2 }}>
        <div
          style={{
            width: 'min(58vw, 240px)',
            aspectRatio: '9 / 16',
            borderRadius: 22,
            overflow: 'hidden',
            background: `linear-gradient(180deg, ${direction.color} 0%, #16304f 42%, #081426 100%)`,
            boxShadow: '0 30px 60px -20px rgba(0,0,0,.65)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '9% 8%',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden>
            <path d="M20 4 L24 16 L36 20 L24 24 L20 36 L16 24 L4 20 L16 16 Z" fill="rgba(255,255,255,.92)" />
          </svg>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,.92)' }}>Spindle</div>
          <div style={{ marginTop: '9%', padding: '5px 13px', borderRadius: 999, background: 'rgba(8,20,38,.55)', fontSize: 11, fontWeight: 900, color: '#fff' }}>
            {direction.label}쪽
          </div>
          <div style={{ marginTop: 12, fontSize: 10.5, lineHeight: 1.6, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{direction.message}</div>
          {/* 대표 이미지 패널 — 실제 PNG(shareCard.ts drawImagePanel)와 같은 구성 */}
          <div
            style={{
              marginTop: '7%',
              width: '82%',
              aspectRatio: '840 / 520',
              borderRadius: 11,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(255,255,255,.18), rgba(8,20,38,.35))',
              border: '1px solid rgba(255,255,255,.32)',
            }}
          >
            {showImage ? (
              <img
                src={imageUrl ?? undefined}
                alt=""
                onError={() => setPreviewFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden>
                <path d="M20 4 L24 16 L36 20 L24 24 L20 36 L16 24 L4 20 L16 16 Z" fill="rgba(255,255,255,.72)" />
              </svg>
            )}
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>{poi.name}</div>
            <div style={{ marginTop: 5, fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
              부산 {poi.district} · 걸어서 약 {poi.walkMinutes}분
            </div>
          </div>
          <div style={{ marginTop: '9%', fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>Spindle이 정해준 오늘의 방향</div>
        </div>
      </div>

      <div style={{ padding: '0 24px calc(26px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
        {/*
          이 화면도 TourAPI 데이터(관광지명·대표 이미지)를 보여 준다 — 출처 표기는 생성된 PNG뿐
          아니라 화면에도 필요하다 (절대 원칙 6). 어두운 배경이라 색만 맞춰 준다.
        */}
        <SourceLine style={{ margin: 0, color: 'rgba(255,255,255,.5)' }} />
        {notice && <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{notice}</div>}
        {canShare && (
          <button className="btn btn-primary" onClick={handleShare} disabled={busy !== 'idle'}>
            {busy === 'sharing' ? '카드 만드는 중…' : '공유하기'}
          </button>
        )}
        {/*
          앱에서는 '이미지로 저장'을 두지 않는다. Capacitor WebView에는 다운로드 리스너가 없어
          `<a download>`이 아무 일도 하지 않기 때문이다 — 눌러도 반응이 없는 버튼이 된다.

          문구로 저장을 약속하지는 않는다. 안드로이드 공유 시트는 OS의 저장 기능이 아니라
          `ACTION_SEND`를 받겠다고 선언한 **설치된 앱** 목록일 뿐이라, 사진·파일 앱이 뜬다는
          보장이 없다. 그래서 "보낼 수 있다"까지만 말한다.
        */}
        {isApp ? (
          <p style={{ margin: 0, textAlign: 'center', fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: 'var(--ink-2)' }}>
            공유할 앱을 고르면 카드 이미지가 그대로 전달돼요
          </p>
        ) : (
          <button className={`btn ${canShare ? 'btn-ghost' : 'btn-primary'}`} style={{ height: canShare ? 52 : 58 }} onClick={handleSave} disabled={busy !== 'idle'}>
            {busy === 'saving' ? '카드 만드는 중…' : '이미지로 저장'}
          </button>
        )}
      </div>
    </ScreenFrame>
  )
}
