import { useEffect, useState } from 'react'
import { fetchPoiDetailByTitleCached } from '../api/poiLookup'
import { ScreenFrame } from '../components/ScreenFrame'
import { markVisited, useVisited } from '../lib/visited'
import type { Recommendation } from '../mock/pois'

interface Props {
  rec: Recommendation
  candidateIndex: number
  onNextCandidate: () => void
  onBack: () => void
  onRespin: () => void
  onShare: () => void
}

/** S4 결과 카드 · 의미 레이어 (디자인 3a-4) — 이야기 · 왜 여기? · 도장 힌트 */
export function ResultScreen({ rec, candidateIndex, onNextCandidate, onBack, onRespin, onShare }: Props) {
  const { direction } = rec
  const poi = rec.candidates[candidateIndex]
  const [loading, setLoading] = useState(true)
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null)
  const [detailImageLoading, setDetailImageLoading] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [navSheet, setNavSheet] = useState(false)
  const [stampToast, setStampToast] = useState<string | null>(null)
  const visited = useVisited()
  const alreadyVisited = visited.has(poi.id)

  // 목 단계: 상세 API(Phase 3 detailCommon2) 로딩을 흉내 낸 스켈레톤
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), candidateIndex === 0 ? 700 : 350)
    return () => clearTimeout(timer)
  }, [candidateIndex])

  useEffect(() => {
    let cancelled = false
    setDetailImageUrl(null)
    setDetailImageLoading(true)
    setImageFailed(false)
    fetchPoiDetailByTitleCached(poi.name)
      .then((detail) => {
        if (!cancelled) setDetailImageUrl(detail?.imageUrl ?? null)
      })
      .finally(() => {
        if (!cancelled) setDetailImageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [poi.name])

  // 도장 획득 토스트 자동 숨김
  useEffect(() => {
    if (!stampToast) return
    const timer = setTimeout(() => setStampToast(null), 2600)
    return () => clearTimeout(timer)
  }, [stampToast])

  const mapQuery = encodeURIComponent(`부산 ${poi.name}`)
  const stampDistrict = poi.district.replace(/구$/, '')

  // 길찾기(=방문 의사)에서 도장을 획득한다 — 새 방문일 때만 연출.
  const openNav = () => {
    setNavSheet(true)
    if (markVisited(poi.id)) setStampToast(`${stampDistrict} 도장을 획득했어요!`)
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 0', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ padding: '8px 16px', background: 'var(--l-ink)', borderRadius: 20, fontSize: 13, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={direction.color} aria-hidden>
            <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
          </svg>
          {direction.label} · {poi.district}
        </div>
        <div style={{ width: 40 }} />
      </header>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 132px' }}>
        {loading ? (
          <ResultSkeleton />
        ) : (
          <div key={poi.id} className="fade-up">
            {/* 대표 이미지 — TourAPI 상세 이미지가 있으면 표시, 없으면 방위색 폴백 */}
            <div style={{ height: 196, borderRadius: 24, position: 'relative', background: `linear-gradient(135deg, ${direction.color}, #1e4fd8 130%)`, overflow: 'hidden' }}>
              {detailImageUrl && !imageFailed ? (
                <img
                  src={detailImageUrl}
                  alt={poi.name}
                  onError={() => setImageFailed(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <>
                  <svg viewBox="0 0 354 196" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.42 }} preserveAspectRatio="xMidYMid slice" aria-hidden>
                    <g fill="none" stroke="#bcd7f7" strokeWidth={2}>
                      <path d="M0 150 L50 120 L100 150 M50 120 L50 196 M110 150 L150 128 L190 150" />
                      <rect x="230" y="110" width="22" height="86" />
                      <rect x="258" y="88" width="26" height="108" />
                      <rect x="290" y="120" width="20" height="76" />
                    </g>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1.6} aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <circle cx="9" cy="11" r="2" />
                      <path d="M3 17 l5-4 4 3 3-3 6 5" />
                    </svg>
                  </div>
                </>
              )}
              {detailImageUrl && !imageFailed && (
                <svg viewBox="0 0 354 196" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.16 }} preserveAspectRatio="none" aria-hidden>
                  <rect width="354" height="196" fill="url(#resultImageShade)" />
                  <defs>
                    <linearGradient id="resultImageShade" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="rgba(0,0,0,0)" />
                      <stop offset="1" stopColor="rgba(0,0,0,.45)" />
                    </linearGradient>
                  </defs>
                </svg>
              )}
              {poi.tier === 3 && (
                <div style={{ position: 'absolute', top: 12, left: 12, padding: '6px 12px', background: 'rgba(255,255,255,.94)', borderRadius: 14, fontSize: 11, fontWeight: 800, color: 'var(--l-orange)' }}>
                  ✦ 숨은 명소
                </div>
              )}
              {(!detailImageUrl || imageFailed) && (
                <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>
                  {detailImageLoading ? '이미지 불러오는 중' : '대표 이미지 없음'}
                </span>
              )}
            </div>

            <div style={{ padding: '16px 2px 0' }}>
              <h2 style={{ margin: 0, fontSize: 25, fontWeight: 900, letterSpacing: -0.5, color: 'var(--l-ink)' }}>{poi.name}</h2>
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)' }}>
                {poi.category} · {poi.district} · 걸어서 약 {poi.walkMinutes}분
              </div>

              {/* 운영상태 — 파싱 성공 시 초록 점, 실패 시 원문 그대로 (ui.md S4) */}
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 12, background: poi.open.known ? '#e6f7ef' : '#eef2fb', fontSize: 12.5, fontWeight: 800, color: poi.open.known ? '#12855b' : 'var(--l-ink-3)' }}>
                {poi.open.known && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1fa971' }} />}
                {poi.open.text}
              </div>

              {/* 이 동네 이야기 */}
              <div style={{ marginTop: 14, padding: '14px 16px', background: '#fff', borderRadius: 18, boxShadow: '0 8px 20px -14px rgba(20,40,90,.3)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--l-primary)', marginBottom: 5 }}>이 동네 이야기</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, fontWeight: 500, color: 'var(--l-ink-2)' }}>{poi.story}</div>
              </div>

              {/* 왜 여기? */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#eef4ff', borderRadius: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--l-primary)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} aria-hidden>
                    <path d="M9 12 l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.45, fontWeight: 600, color: '#3f66c8' }}>
                  <b style={{ fontWeight: 800, color: 'var(--l-ink)' }}>왜 여기?</b> {direction.label}쪽 후보 중 걸어서 {poi.walkMinutes}분
                  {poi.tier === 3 ? ' · 덜 알려진 곳이라 지금이 조용할 때예요' : ' · 방향이 정확히 맞았어요'}
                </div>
              </div>

              {/* 도장 힌트 — 방문 기록(lib/visited.ts)에 따라 상태가 바뀐다 */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: alreadyVisited ? 'none' : '2px dashed #b9cdf0',
                    background: alreadyVisited ? 'radial-gradient(circle at 38% 32%,#5b93ff,#1e4fd8)' : 'transparent',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={alreadyVisited ? '#fff' : '#b9cdf0'} aria-hidden>
                    <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
                  </svg>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--l-ink-3)' }}>
                  {alreadyVisited ? (
                    <>
                      <b style={{ color: 'var(--l-primary)' }}>{stampDistrict} 도장</b>을 받았어요
                    </>
                  ) : (
                    <>
                      방문하면 <b style={{ color: 'var(--l-primary)' }}>{stampDistrict} 도장</b>을 획득해요
                    </>
                  )}
                </div>
              </div>

              {rec.candidates.length > 1 && (
                <button
                  onClick={onNextCandidate}
                  className="btn"
                  style={{ width: '100%', height: 52, marginTop: 16, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', fontSize: 15 }}
                >
                  다른 후보 보기
                  <span style={{ color: 'var(--l-ink-3)', fontWeight: 700 }}>
                    {candidateIndex + 1}/{rec.candidates.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 액션 바 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px calc(18px + env(safe-area-inset-bottom))', display: 'flex', gap: 12, background: 'linear-gradient(transparent, var(--l-bg) 40%)', zIndex: 3 }}>
        <button className="btn btn-blue" style={{ flex: 1, height: 56, fontSize: 16 }} onClick={openNav} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7 z m0 9.5 a2.5 2.5 0 1 1 0-5 a2.5 2.5 0 0 1 0 5 z" />
          </svg>
          길찾기
        </button>
        <button onClick={onShare} aria-label="공유 카드 만들기" className="btn" style={{ width: 56, height: 56, borderRadius: 20, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.2 10.8 L15.8 7.2 M8.2 13.2 L15.8 16.8" />
          </svg>
        </button>
        <button onClick={onRespin} aria-label="다시 돌리기" className="btn" style={{ width: 56, height: 56, borderRadius: 20, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M3 12 a9 9 0 1 1 3 6.7" />
            <path d="M3 20 v-4 h4" />
          </svg>
        </button>
      </div>

      {/* 길찾기 앱 선택 시트 */}
      {navSheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <button aria-label="닫기" onClick={() => setNavSheet(false)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(12,26,54,.45)', cursor: 'pointer' }} />
          <div className="fade-up" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 20px calc(26px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(20,40,90,.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--l-ink)', marginBottom: 14 }}>어떤 지도로 안내할까요?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <NavLink href={`https://map.kakao.com/link/search/${mapQuery}`} label="카카오맵" color="#ffd93b" ink="#3d2c00" />
              <NavLink href={`https://map.naver.com/p/search/${mapQuery}`} label="네이버지도" color="#2db400" ink="#fff" />
            </div>
          </div>
        </div>
      )}

      {/* 도장 획득 토스트 */}
      {stampToast && (
        <div
          className="fade-up"
          role="status"
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 'calc(90px + env(safe-area-inset-bottom))',
            zIndex: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 16px',
            background: 'var(--l-ink)',
            borderRadius: 16,
            color: '#fff',
            boxShadow: '0 12px 30px -10px rgba(20,40,90,.55)',
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#5b93ff,#1e4fd8)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
            </svg>
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{stampToast}</span>
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
      style={{ height: 54, background: 'var(--l-bg)', border: '1.5px solid var(--l-line)', color: 'var(--l-ink)', fontSize: 15, textDecoration: 'none', justifyContent: 'flex-start', paddingLeft: 16, gap: 12 }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 9, background: color, display: 'grid', placeItems: 'center', color: ink, fontSize: 12, fontWeight: 900 }}>{label[0]}</span>
      {label}으로 길찾기
    </a>
  )
}

function ResultSkeleton() {
  return (
    <div aria-label="불러오는 중">
      <div className="skeleton" style={{ height: 196, borderRadius: 24 }} />
      <div style={{ padding: '16px 2px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 28, width: '58%' }} />
        <div className="skeleton" style={{ height: 14, width: '76%' }} />
        <div className="skeleton" style={{ height: 34, width: 140, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 84, width: '100%', borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 58, width: '100%', borderRadius: 16 }} />
      </div>
    </div>
  )
}
