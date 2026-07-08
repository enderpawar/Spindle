import { useEffect, useState } from 'react'
import { fetchOldTownFestivalsCached, todayYyyymmdd } from '../api/festivals'
import { isFestivalOngoing, type Festival } from '../engine/festival'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { ScreenFrame } from '../components/ScreenFrame'

interface Props {
  onNavigate: (tab: NavTab) => void
  onBack: () => void
}

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; festivals: Festival[] }

function shortDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd
  return `${Number(yyyymmdd.slice(4, 6))}.${Number(yyyymmdd.slice(6, 8))}`
}

/** 원도심·영도에서 지금 진행 중인 축제 (Phase 7) — searchFestival2 실시간 조회. */
export function FestivalScreen({ onNavigate, onBack }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const today = todayYyyymmdd()
    setState({ kind: 'loading' })
    fetchOldTownFestivalsCached(today)
      .then((list) => {
        if (cancelled) return
        const ongoing = list
          .filter((f) => isFestivalOngoing(f, today))
          .sort((a, b) => a.endDate.localeCompare(b.endDate))
        setState({ kind: 'ready', festivals: ongoing })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--l-ink)', letterSpacing: -0.4 }}>지금 원도심 축제</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>오늘 진행 중인 축제만 모았어요</div>
        </div>
      </header>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '10px 16px calc(110px + env(safe-area-inset-bottom))' }}>
        {state.kind === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="불러오는 중">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 92, borderRadius: 18 }} />
            ))}
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--l-ink-2)' }}>잠시 연결이 어려워요</div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn"
              style={{ marginTop: 14, height: 46, padding: '0 22px', background: 'var(--l-primary)', color: '#fff', fontSize: 14 }}
            >
              다시 시도
            </button>
          </div>
        )}

        {state.kind === 'ready' && state.festivals.length === 0 && (
          <div style={{ marginTop: 46, textAlign: 'center', padding: '0 24px' }}>
            <div aria-hidden style={{ fontSize: 40 }}>🎈</div>
            <div style={{ marginTop: 10, fontSize: 14.5, fontWeight: 800, color: 'var(--l-ink)' }}>지금은 진행 중인 축제가 없어요</div>
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--l-ink-3)', lineHeight: 1.5 }}>
              대신 스핀을 돌려 숨은 명소를 찾아보는 건 어때요?
            </div>
            <button
              onClick={() => onNavigate('spin')}
              className="btn"
              style={{ marginTop: 16, height: 48, padding: '0 22px', background: 'var(--l-primary)', color: '#fff', fontSize: 14 }}
            >
              스핀하러 가기
            </button>
          </div>
        )}

        {state.kind === 'ready' && state.festivals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.festivals.map((f) => (
              <a
                key={f.contentId}
                href={`https://map.kakao.com/link/search/${encodeURIComponent(`부산 ${f.title}`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ padding: 0, height: 'auto', display: 'flex', alignItems: 'stretch', gap: 0, background: '#fff', border: '1px solid var(--l-line)', borderRadius: 18, overflow: 'hidden', textDecoration: 'none' }}
              >
                <div style={{ width: 92, flex: 'none', background: f.imageUrl ? `center/cover no-repeat url(${f.imageUrl})` : 'linear-gradient(145deg,#ff9e7a,#e0603f)', display: 'grid', placeItems: 'center' }}>
                  {!f.imageUrl && (
                    <span aria-hidden style={{ fontSize: 30 }}>
                      🎉
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, padding: '12px 14px', textAlign: 'left' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--l-ink)', lineHeight: 1.3 }}>{f.title}</div>
                  <div style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                    {f.district ? `${f.district} · ` : ''}
                    {shortDate(f.startDate)}–{shortDate(f.endDate)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--l-primary)' }}>지도에서 보기 ›</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </ScreenFrame>
  )
}
