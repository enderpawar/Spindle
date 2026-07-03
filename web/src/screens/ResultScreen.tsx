import { useEffect, useState } from 'react'
import { ScreenFrame } from '../components/ScreenFrame'
import type { Recommendation } from '../mock/pois'

interface Props {
  rec: Recommendation
  candidateIndex: number
  onNextCandidate: () => void
  onRespin: () => void
  onShare: () => void
}

/** S4 결과 카드 — 밤바다 위로 떠오른 엽서 한 장 */
export function ResultScreen({ rec, candidateIndex, onNextCandidate, onRespin, onShare }: Props) {
  const { direction } = rec
  const poi = rec.candidates[candidateIndex]
  const [loading, setLoading] = useState(true)
  const [navSheet, setNavSheet] = useState(false)

  // 목 단계: 상세 API(Phase 3 detailCommon2) 로딩을 흉내 낸 스켈레톤
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), candidateIndex === 0 ? 750 : 350)
    return () => clearTimeout(timer)
  }, [candidateIndex])

  const mapQuery = encodeURIComponent(`부산 ${poi.name}`)

  return (
    <ScreenFrame>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', zIndex: 2 }}>
        <button onClick={onRespin} aria-label="홈으로" className="btn btn-ghost" style={{ width: 44, height: 44, borderRadius: '50%', padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div className="chip" style={{ background: direction.color, border: 'none', color: '#0f2540', fontWeight: 900 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#0f2540" aria-hidden>
            <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
          </svg>
          {direction.label}쪽 · 오늘의 발견
        </div>
        <div style={{ width: 44 }} />
      </header>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 132px', zIndex: 1 }}>
        {loading ? (
          <ResultSkeleton />
        ) : (
          <div key={poi.id} className="fade-up">
            {/* 엽서 카드 */}
            <div style={{ background: 'var(--card)', borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 60px -24px rgba(0,0,0,.6)' }}>
              {/* 대표 이미지 — 목 단계는 항상 폴백(방위 색 + 나침반 아이콘) */}
              <div style={{ position: 'relative', height: 188, background: `linear-gradient(150deg, ${direction.color}, #16304f 130%)`, display: 'grid', placeItems: 'center' }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth={1.4} aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.8 9.2 L11 11 L9.2 14.8 L13 13 Z" fill="rgba(255,255,255,.65)" />
                </svg>
                {poi.tier === 3 && (
                  <span style={{ position: 'absolute', top: 14, left: 14, padding: '7px 12px', borderRadius: 12, background: 'rgba(15,37,64,.82)', color: '#ffd8a8', fontSize: 11.5, fontWeight: 800 }}>
                    ✦ 숨은 명소
                  </span>
                )}
                <span style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>이미지 준비 중</span>
              </div>

              <div style={{ padding: '20px 20px 22px' }}>
                <h2 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: -0.5, color: 'var(--card-ink)' }}>{poi.name}</h2>
                <div style={{ marginTop: 5, fontSize: 13, fontWeight: 600, color: 'var(--card-ink-2)' }}>
                  {poi.category} · {poi.district} · 걸어서 약 {poi.walkMinutes}분
                </div>

                {/* 운영상태 — 파싱 성공 시 초록 점, 실패 시 원문 그대로 (ui.md S4) */}
                <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 12, background: poi.open.known ? '#e9f9f1' : '#f1f4fa', fontSize: 12.5, fontWeight: 800, color: poi.open.known ? '#0f8a5c' : 'var(--card-ink-2)' }}>
                  {poi.open.known && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />}
                  {poi.open.text}
                </div>

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--card-line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: direction.color, filter: 'brightness(.72) saturate(1.4)' }}>이 동네 이야기</div>
                  <p style={{ margin: '7px 0 0', fontSize: 14, lineHeight: 1.65, fontWeight: 500, color: '#3c4d68' }}>{poi.story}</p>
                </div>

                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: '#f4f7fc', fontSize: 12.5, lineHeight: 1.55, fontWeight: 600, color: '#51648a' }}>
                  <b style={{ fontWeight: 900, color: 'var(--card-ink)' }}>왜 여기?</b> {direction.label}쪽 후보 중 걸어서 {poi.walkMinutes}분
                  {poi.tier === 3 ? ' · 덜 알려진 곳이라 지금이 조용할 때예요' : ' · 방향이 정확히 맞았어요'}
                </div>
              </div>
            </div>

            <button className="btn btn-ghost" style={{ width: '100%', height: 52, marginTop: 14 }} onClick={onNextCandidate}>
              다른 후보 보기
              <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>
                {candidateIndex + 1}/{rec.candidates.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 하단 액션 바 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px calc(18px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, background: 'linear-gradient(transparent, var(--bg-0) 38%)', zIndex: 3 }}>
        <button onClick={onRespin} aria-label="다시 돌리기" className="btn btn-ghost" style={{ width: 58, height: 58, borderRadius: 18, padding: 0, flex: 'none' }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M4 12 a8 8 0 1 1 2.6 5.9" />
            <path d="M4 19 v-4 h4" />
          </svg>
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setNavSheet(true)} disabled={loading}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z m0 9.5 a2.5 2.5 0 1 1 0-5 a2.5 2.5 0 0 1 0 5 z" />
          </svg>
          길찾기
        </button>
        <button onClick={onShare} aria-label="공유 카드 만들기" className="btn btn-ghost" style={{ width: 58, height: 58, borderRadius: 18, padding: 0, flex: 'none' }} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.2 10.8 L15.8 7.2 M8.2 13.2 L15.8 16.8" />
          </svg>
        </button>
      </div>

      {/* 길찾기 앱 선택 시트 */}
      {navSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <button aria-label="닫기" onClick={() => setNavSheet(false)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(4,10,22,.6)', cursor: 'pointer' }} />
          <div className="fade-up" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: '24px 24px 0 0', padding: '22px 20px calc(26px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>어떤 지도로 안내할까요?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <NavLink href={`https://map.kakao.com/link/search/${mapQuery}`} label="카카오맵" color="#ffd93b" ink="#3d2c00" />
              <NavLink href={`https://map.naver.com/p/search/${mapQuery}`} label="네이버지도" color="#2db400" ink="#fff" />
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  )
}

function NavLink({ href, label, color, ink }: { href: string; label: string; color: string; ink: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn"
      style={{ height: 54, background: 'var(--glass-2)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 15, textDecoration: 'none', justifyContent: 'flex-start', paddingLeft: 16, gap: 12 }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 9, background: color, display: 'grid', placeItems: 'center', color: ink, fontSize: 12, fontWeight: 900 }}>
        {label[0]}
      </span>
      {label}으로 길찾기
    </a>
  )
}

function ResultSkeleton() {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 60px -24px rgba(0,0,0,.6)' }} aria-label="불러오는 중">
      <div className="skeleton" style={{ height: 188, borderRadius: 0 }} />
      <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 26, width: '58%' }} />
        <div className="skeleton" style={{ height: 14, width: '76%' }} />
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 64, width: '100%' }} />
      </div>
    </div>
  )
}
