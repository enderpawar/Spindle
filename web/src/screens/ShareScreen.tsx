import { useState } from 'react'
import { ScreenFrame, Stars } from '../components/ScreenFrame'
import { buildShareCardBlob } from '../lib/shareCard'
import type { Poi, Recommendation } from '../mock/pois'

interface Props {
  rec: Recommendation
  poi: Poi
  onBack: () => void
}

type BusyState = 'idle' | 'saving' | 'sharing'

/** S5 공유 카드 — Web Share API + 다운로드 폴백 */
export function ShareScreen({ rec, poi, onBack }: Props) {
  const { direction } = rec
  const [busy, setBusy] = useState<BusyState>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const canShare = typeof navigator.share === 'function'

  const makeBlob = () =>
    buildShareCardBlob({
      poiName: poi.name,
      districtLine: `부산 ${poi.district} · 걸어서 약 ${poi.walkMinutes}분`,
      message: direction.message,
      directionLabel: direction.label,
      color: direction.color,
    })

  const handleSave = async () => {
    setBusy('saving')
    setNotice(null)
    try {
      const blob = await makeBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `spindle-${direction.id.toLowerCase()}-${poi.id}.png`
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
      const file = new File([blob], 'spindle.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Spindle', text: `오늘의 방향은 ${direction.label}쪽 — ${poi.name}` })
      } else {
        await navigator.share({ title: 'Spindle', text: `오늘의 방향은 ${direction.label}쪽 — ${poi.name}` })
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
          <div style={{ marginTop: '16%', padding: '5px 13px', borderRadius: 999, background: 'rgba(8,20,38,.55)', fontSize: 11, fontWeight: 900, color: '#fff' }}>
            {direction.label}쪽
          </div>
          <div style={{ marginTop: 12, fontSize: 10.5, lineHeight: 1.6, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{direction.message}</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>{poi.name}</div>
            <div style={{ marginTop: 5, fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
              부산 {poi.district} · 걸어서 약 {poi.walkMinutes}분
            </div>
          </div>
          <div style={{ marginTop: '14%', fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>Spindle이 정해준 오늘의 방향</div>
        </div>
      </div>

      <div style={{ padding: '0 24px calc(26px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
        {notice && <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{notice}</div>}
        {canShare && (
          <button className="btn btn-primary" onClick={handleShare} disabled={busy !== 'idle'}>
            {busy === 'sharing' ? '카드 만드는 중…' : '공유하기'}
          </button>
        )}
        <button className={`btn ${canShare ? 'btn-ghost' : 'btn-primary'}`} style={{ height: canShare ? 52 : 58 }} onClick={handleSave} disabled={busy !== 'idle'}>
          {busy === 'saving' ? '카드 만드는 중…' : '이미지로 저장'}
        </button>
      </div>
    </ScreenFrame>
  )
}
