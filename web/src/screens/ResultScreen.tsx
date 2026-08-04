import { useEffect, useState } from 'react'
import { fetchPoiCardDetailCached, fetchPoiDetailCached, fetchPoiGalleryImagesCached, knownPoiImageUrl, selectPrimaryVisitFacts, type PoiDetail, type PoiVisitFact } from '../api/details'
import { fetchOldTownFestivalsCached, todayYyyymmdd } from '../api/festivals'
import { pickFestivalForDirection, type Festival } from '../engine/festival'
import { ScreenFrame } from '../components/ScreenFrame'
import { SourceLine } from '../components/SourceLine'
import { StampNotice } from '../components/StampNotice'
import { CuratedCopy } from '../components/CuratedCopy'
import { copyOf } from '../engine/curation'
import { evaluateOperation, type OperationStatus } from '../engine/operation'
import { kakaoMapSearchUrl } from '../lib/mapLinks'
import { markVisited } from '../lib/visited'
import { overviewExcerpt } from '../lib/overviewExcerpt'
import type { Poi, Recommendation } from '../mock/pois'

interface Props {
  rec: Recommendation
  candidateIndex: number
  onNextCandidate: () => void
  onBack: () => void
  onRespin: () => void
  onShare: () => void
  onContinueTheme: () => void
  onFinishTheme: () => void
  initialCourseNotice?: string | null
  /**
   * 이 방향으로 코스 짜기 — 현재 보고 있는 장소를 첫 장소로 코스를 만든다.
   * 코스가 만들어지면 App이 코스 화면으로 이동(반환값 null), 장소가 부족하면 사유 문자열을 반환한다.
   */
  onBuildCourse: (anchor: Poi) => string | null
}

/** S4 결과 카드 · 의미 레이어 (디자인 3a-4) — 이야기 · 왜 여기? · 도장 힌트 */
export function ResultScreen({ rec, candidateIndex, onNextCandidate, onBack, onRespin, onShare, onContinueTheme, onFinishTheme, onBuildCourse, initialCourseNotice = null }: Props) {
  const { direction } = rec
  const poi = rec.candidates[candidateIndex]
  const [loading, setLoading] = useState(true)
  const [courseNotice, setCourseNotice] = useState<string | null>(initialCourseNotice)
  const [detail, setDetail] = useState<PoiDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [stampToast, setStampToast] = useState<string | null>(null)
  const [festival, setFestival] = useState<Festival | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [fullDetail, setFullDetail] = useState<PoiDetail | null>(null)
  const [fullDetailLoading, setFullDetailLoading] = useState(false)
  const [fullDetailError, setFullDetailError] = useState(false)
  const [operation, setOperation] = useState<OperationStatus | null>(null)

  // 운영 중단·운영시간 외 안내 — 이미 세션 캐시에 있는 상세 원문을 재사용한다(추가 호출 없음).
  useEffect(() => {
    let alive = true
    setOperation(null)
    fetchPoiDetailCached(poi.contentId)
      .then((d) => {
        if (!alive) return
        setOperation(
          evaluateOperation({ usetime: d.usetime, restdate: d.restdate, overview: d.overview }),
        )
      })
      .catch(() => {
        /* 상세 실패는 기존 에러 UI가 다룬다 — 운영 안내만 생략 */
      })
    return () => {
      alive = false
    }
  }, [poi.contentId])

  // 목 단계: 상세 API(Phase 3 detailCommon2) 로딩을 흉내 낸 스켈레톤
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), candidateIndex === 0 ? 320 : 180)
    return () => clearTimeout(timer)
  }, [candidateIndex])

  useEffect(() => {
    setGalleryOpen(false)
    setGalleryImages([])
    setGalleryIndex(0)
    setGalleryLoading(false)
    setInfoOpen(false)
    setFullDetail(null)
    setFullDetailLoading(false)
    setFullDetailError(false)
    setCourseNotice(initialCourseNotice)
  }, [initialCourseNotice, poi.contentId])

  // 프리뷰 카드의 주소·운영·휴무 표를 위해 결과 시점에 상세 소개도 실시간 조회한다.
  // 기존 details.ts 세션 메모리 캐시만 사용하며 영속 저장은 하지 않는다.
  useEffect(() => {
    let cancelled = false
    setFullDetail(null)
    setFullDetailLoading(true)
    setFullDetailError(false)
    fetchPoiDetailCached(poi.contentId)
      .then((d) => {
        if (!cancelled) {
          setFullDetail(d)
          setFullDetailError(d.visitFactsStatus === 'error')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullDetail(null)
          setFullDetailError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setFullDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [poi.contentId])

  // 코스 짜기 — 성공 시 App이 코스 화면으로 이동, 실패(장소 부족) 시 인라인 사유 노출
  const buildCourse = () => setCourseNotice(onBuildCourse(poi))

  // 결과 시점 실시간 조회 — contentId로 detailCommon2/detailImage2(대표 이미지) + overview(소개).
  // 응답은 세션 메모리 캐시에만 보관하고(details.ts) 영속 저장하지 않는다. 실패해도 폴백으로 카드는 뜬다.
  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setDetailLoading(true)
    setImageFailed(false)
    fetchPoiCardDetailCached(poi.contentId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [poi.contentId])

  // 방위+기간이 맞는 축제만 특별 카드로 (없거나 실패하면 조용히 미표시)
  useEffect(() => {
    let cancelled = false
    const today = todayYyyymmdd()
    setFestival(null)
    const timer = window.setTimeout(() => {
      fetchOldTownFestivalsCached(today)
        .then((list) => {
          if (!cancelled) setFestival(pickFestivalForDirection(list, direction.id, today))
        })
        .catch(() => {
          if (!cancelled) setFestival(null)
        })
    }, 900)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [direction.id])

  // 도장 획득 토스트 자동 숨김
  useEffect(() => {
    if (!stampToast) return
    const timer = setTimeout(() => setStampToast(null), 2600)
    return () => clearTimeout(timer)
  }, [stampToast])

  // TourAPI 상세에서 온 값이 있으면 우선 사용, 없으면 큐레이션 폴백.
  // 상세(detailCommon2)는 실측 4~5초라 그때까지 히어로가 비어 있었다. 세션 목록이 이미
  // 알려준 URL이 있으면 먼저 띄우고, 상세가 오면 그 값으로 대체한다(대개 같은 URL).
  const detailImageUrl = detail?.imageUrl ?? knownPoiImageUrl(poi.contentId)
  const detailImageLoading = detailLoading
  const storyText = overviewExcerpt(detail?.overview ?? poi.story)
  const infoDetail = fullDetail ?? detail
  const infoStory = (infoDetail?.overview ?? poi.story).trim()
  const infoParagraphs = splitStoryParagraphs(infoStory)
  const addressText = infoDetail?.addr1 ?? `부산 ${poi.district}`
  const primaryVisitFacts = selectPrimaryVisitFacts(fullDetail?.visitFacts ?? [])
  const activeGalleryImage = galleryImages[galleryIndex] ?? detailImageUrl
  const curatedCopy = copyOf(poi.contentId)

  const openGallery = () => {
    setGalleryOpen(true)
    setGalleryIndex(0)
    if (galleryImages.length > 0 || galleryLoading) return
    setGalleryLoading(true)
    fetchPoiGalleryImagesCached(poi.contentId)
      .then((images) => {
        const fallback = detailImageUrl ? [detailImageUrl] : []
        setGalleryImages(images.length > 0 ? images : fallback)
      })
      .catch(() => {
        setGalleryImages(detailImageUrl ? [detailImageUrl] : [])
      })
      .finally(() => setGalleryLoading(false))
  }

  const moveGallery = (delta: number) => {
    setGalleryIndex((index) => {
      if (galleryImages.length === 0) return index
      return (index + delta + galleryImages.length) % galleryImages.length
    })
  }

  const openInfo = () => {
    setInfoOpen(true)
    if (fullDetail || fullDetailLoading) return
    retryFullDetail()
  }

  const retryFullDetail = () => {
    setFullDetailLoading(true)
    setFullDetailError(false)
    fetchPoiDetailCached(poi.contentId)
      .then((d) => {
        setFullDetail(d)
        setFullDetailError(d.visitFactsStatus === 'error')
      })
      .catch(() => {
        setFullDetail(null)
        setFullDetailError(true)
      })
      .finally(() => setFullDetailLoading(false))
  }

  // 길찾기(=방문 의사)에서 도장을 획득한다 — 새 방문일 때만 연출.
  const recordNavigation = () => {
    setStampToast(null)
    if (markVisited(poi.id)) setStampToast(poi.district)
  }

  return (
    <ScreenFrame style={{ background: 'var(--l-bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 0', zIndex: 2 }}>
        <button onClick={onBack} aria-label="뒤로" className="l-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </button>
        <div style={{ width: 40 }} />
      </header>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 132px' }}>
        {festival && <FestivalBanner festival={festival} />}
        {loading ? (
          <ResultSkeleton />
        ) : (
          <div key={poi.id} className="motion-card-enter">
            {/* 대표 이미지는 첫 화면의 이동·운영 정보가 함께 보이도록 높이를 제한한다. */}
            <div style={{ height: 'clamp(190px, 30svh, 300px)', borderRadius: 24, position: 'relative', background: `linear-gradient(135deg, ${direction.color}, #1e4fd8 130%)`, overflow: 'hidden' }}>
              {detailImageUrl && !imageFailed ? (
                <img
                  src={detailImageUrl}
                  alt={poi.name}
                  onError={() => setImageFailed(true)}
                  onClick={openGallery}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
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
                  <div className={`result-image-fallback${curatedCopy ? ' result-image-fallback--curated' : ''}`}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1.6} aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <circle cx="9" cy="11" r="2" />
                      <path d="M3 17 l5-4 4 3 3-3 6 5" />
                    </svg>
                    {curatedCopy && (
                      <div className="result-image-fallback-copy">
                        <strong>{poi.name}</strong>
                        <span>{curatedCopy}</span>
                      </div>
                    )}
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
              {detailImageUrl && !imageFailed && (
                <button
                  type="button"
                  onClick={openGallery}
                  aria-label={`${poi.name} 사진 더 보기`}
                  style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 2, minWidth: 44, minHeight: 44, border: 'none', borderRadius: 15, background: 'rgba(15,37,64,.78)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 900, backdropFilter: 'blur(6px)' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M3 17 l5-4 4 3 3-3 6 5" />
                  </svg>
                  사진
                </button>
              )}
              {(!detailImageUrl || imageFailed) && (
                <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>
                  {detailImageLoading ? '이미지 불러오는 중' : '대표 이미지 없음'}
                </span>
              )}
            </div>

            <div style={{ padding: '18px 2px 0' }}>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.2, color: 'var(--l-ink)' }}>{poi.name}</h2>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--l-ink-3)' }}>
                {poi.category} · {poi.district} · 도보 약 {poi.walkMinutes}분 · 근사치
              </div>
              {operation?.notice && (
                <div className="operation-notice" role="status">
                  <span className="operation-notice__mark" aria-hidden="true">!</span>
                  {operation.notice}
                </div>
              )}
              <CuratedCopy contentId={poi.contentId} className="result-curation-copy" />

              {/* 주소와 운영·휴무 원문 표는 [자세히 보기] 시트에 유지한다. */}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink-3)" strokeWidth={2.2} strokeLinecap="round" aria-hidden style={{ flex: 'none', marginTop: 3 }}>
                  <path d="M12 21 C8.5 17.5 5 13.6 5 9.5 a7 7 0 0 1 14 0 c0 4.1-3.5 8-7 11.5 z" />
                  <circle cx="12" cy="9.5" r="2.4" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--l-ink-3)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{addressText}</span>
              </div>

              <section className="result-attraction-section" aria-labelledby="result-attraction-title">
                <h3 id="result-attraction-title">이곳의 매력</h3>
                <p>{storyText}</p>
                <button type="button" onClick={openInfo}>자세히 보기 ›</button>
              </section>

              {rec.theme && (
                <section
                  className="result-theme-journey"
                  style={{ '--theme-color': rec.theme.color } as React.CSSProperties}
                  aria-labelledby="result-theme-mission-title"
                >
                  <div className="result-theme-progress">
                    <strong>{rec.theme.label} 테마</strong>
                    <span>{rec.theme.step}/{rec.theme.target}번째 장면</span>
                  </div>
                  <h3 id="result-theme-mission-title">이번 장소에서 해볼 일</h3>
                  <p>{rec.theme.mission}</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={rec.theme.step < rec.theme.target ? onContinueTheme : onFinishTheme}
                  >
                    {rec.theme.step < rec.theme.target ? '같은 테마로 다음 스핀' : '테마 여정 마치기'}
                  </button>
                </section>
              )}

              {fullDetailLoading && <VisitFactsSkeleton />}
              {!fullDetailLoading && primaryVisitFacts.length > 0 && (
                <VisitFactsSection facts={primaryVisitFacts} />
              )}
              {!fullDetailLoading && fullDetailError && (
                <p className="result-visit-error">
                  방문 정보를 불러오지 못했어요.
                  <button type="button" onClick={retryFullDetail}>다시 시도</button>
                </p>
              )}

              {!rec.theme && (
                <>
                  {/* 일반 스핀은 방향 코스로 확장할 수 있다. 테마 여정에서는 다른 테마가 섞이지 않도록 숨긴다. */}
                  <button
                    type="button"
                    onClick={buildCourse}
                    className="btn result-course-action"
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 900, letterSpacing: -0.2 }}>이 방향으로 코스 짜기</span>
                      <span style={{ display: 'block', marginTop: 2.5, fontSize: 12, fontWeight: 600, color: 'var(--l-ink-3)' }}>가까운 장소 2~4곳을 이어 코스로 만들어요</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink-3)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                      <path d="M9 6 l6 6 -6 6" />
                    </svg>
                  </button>
                  {courseNotice && (
                    <p className="result-course-notice" role="status">{courseNotice}</p>
                  )}
                </>
              )}

              {rec.candidates.length > 1 && (
                <button
                  onClick={onNextCandidate}
                  className="btn"
                  style={{ width: '100%', height: 52, marginTop: 12, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', fontSize: 15 }}
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
        <SourceLine />
      </div>

      {/* 하단 액션 바 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px calc(18px + env(safe-area-inset-bottom))', display: 'flex', gap: 12, background: 'linear-gradient(transparent, var(--l-bg) 40%)', zIndex: 3 }}>
        <a
          href={kakaoMapSearchUrl(poi.name)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-blue"
          style={{ flex: 1, height: 56, fontSize: 16, textDecoration: 'none', pointerEvents: loading ? 'none' : undefined, opacity: loading ? 0.55 : undefined }}
          aria-disabled={loading}
          onClick={recordNavigation}
        >
          길찾기
        </a>
        <button onClick={onShare} aria-label="공유 카드 만들기" className="btn" style={{ width: 56, height: 56, borderRadius: 20, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.2 10.8 L15.8 7.2 M8.2 13.2 L15.8 16.8" />
          </svg>
        </button>
        {!rec.theme && <button onClick={onRespin} aria-label="다시 돌리기" className="btn" style={{ width: 56, height: 56, borderRadius: 20, background: '#fff', border: '2px solid #d7e3f8', color: 'var(--l-primary)', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M3 12 a9 9 0 1 1 3 6.7" />
            <path d="M3 20 v-4 h4" />
          </svg>
        </button>}
      </div>

      {stampToast && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(90px + env(safe-area-inset-bottom))', zIndex: 4 }}>
          <StampNotice district={stampToast} />
        </div>
      )}

      {/* 도장 획득 토스트 */}
      {galleryOpen && (
        <div className="motion-overlay" style={{ position: 'absolute', inset: 0, zIndex: 14, background: 'rgba(8,20,38,.72)' }}>
          <button aria-label="닫기" onClick={() => setGalleryOpen(false)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
          <div className="motion-dialog" style={{ position: 'absolute', left: 18, right: 18, top: '8%', bottom: '8%', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.66)' }}>{poi.district}</div>
                <div style={{ marginTop: 2, fontSize: 18, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</div>
              </div>
              <button onClick={() => setGalleryOpen(false)} aria-label="닫기" className="btn" style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(255,255,255,.14)', color: '#fff', padding: 0, flex: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                  <path d="M6 6 l12 12 M18 6 L6 18" />
                </svg>
              </button>
            </div>

            <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 24, overflow: 'hidden', background: `linear-gradient(135deg, ${direction.color}, #1e4fd8 130%)`, display: 'grid', placeItems: 'center', boxShadow: '0 24px 48px -18px rgba(0,0,0,.55)' }}>
              {activeGalleryImage ? (
                <img src={activeGalleryImage} alt={poi.name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#071326' }} />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', gap: 10, color: 'rgba(255,255,255,.78)', fontSize: 13, fontWeight: 800 }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 17 l5-4 4 3 3-3 6 5" />
                  </svg>
                  사진 없음
                </div>
              )}

              {galleryImages.length > 1 && (
                <>
                  <button onClick={() => moveGallery(-1)} aria-label="이전 사진" className="btn gallery-nav" style={{ position: 'absolute', left: 10, top: '50%', width: 46, height: 46, borderRadius: '50%', background: 'rgba(15,37,64,.72)', color: '#fff', padding: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                      <path d="M15 5 L8 12 L15 19" />
                    </svg>
                  </button>
                  <button onClick={() => moveGallery(1)} aria-label="다음 사진" className="btn gallery-nav" style={{ position: 'absolute', right: 10, top: '50%', width: 46, height: 46, borderRadius: '50%', background: 'rgba(15,37,64,.72)', color: '#fff', padding: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                      <path d="M9 5 L16 12 L9 19" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 800 }}>
              {galleryLoading ? '사진 불러오는 중' : galleryImages.length > 0 ? `${galleryIndex + 1} / ${galleryImages.length}` : '대표 사진만 표시'}
            </div>
          </div>
        </div>
      )}

      {infoOpen && (
        <div className="motion-overlay" style={{ position: 'absolute', inset: 0, zIndex: 13 }}>
          <button aria-label="닫기" onClick={() => setInfoOpen(false)} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(12,26,54,.45)', cursor: 'pointer' }} />
          <div className="motion-sheet no-scrollbar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%', overflowY: 'auto', background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 20px calc(28px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(20,40,90,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--l-primary)' }}>이 동네 이야기</div>
                <div style={{ marginTop: 5, fontSize: 21, lineHeight: 1.25, fontWeight: 900, color: 'var(--l-ink)' }}>{poi.name}</div>
                <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--l-ink-3)' }}>{poi.category} · {poi.district}</div>
              </div>
              <button onClick={() => setInfoOpen(false)} aria-label="닫기" className="l-icon-btn" style={{ flex: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                  <path d="M6 6 l12 12 M18 6 L6 18" />
                </svg>
              </button>
            </div>

            <div className="result-info-facts">
              <InfoRow label="주소" value={addressText} />
              <InfoRow label="이동" value={`걸어서 약 ${poi.walkMinutes}분 · 근사치`} />
              {fullDetail?.visitFacts.map((fact) => (
                <InfoRow key={fact.key} label={fact.label} value={fact.value} />
              ))}
            </div>

            {fullDetailLoading && <VisitFactsSkeleton compact />}
            {!fullDetailLoading && fullDetailError && (
              <p className="result-visit-error result-visit-error--sheet">
                방문 정보를 불러오지 못했어요.
                <button type="button" onClick={retryFullDetail}>다시 시도</button>
              </p>
            )}

            <div className="result-info-story">
              {infoParagraphs.map((paragraph, index) => (
                <p
                  key={`${poi.contentId}-story-${index}`}
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.78,
                    fontWeight: 500,
                    letterSpacing: -0.05,
                    color: 'var(--l-ink-2)',
                    wordBreak: 'keep-all',
                    overflowWrap: 'break-word',
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

    </ScreenFrame>
  )
}

/** 긴 TourAPI 소개문을 모바일에서 훑기 쉬운 두 문장 단위 문단으로 묶는다. */
function splitStoryParagraphs(story: string): string[] {
  const normalized = story.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const sentences = normalized.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [normalized]
  const paragraphs: string[] = []
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(' '))
  }
  return paragraphs
}

/** YYYYMMDD → "M.D" */
function shortDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd
  return `${Number(yyyymmdd.slice(4, 6))}.${Number(yyyymmdd.slice(6, 8))}`
}

/** 축제 특별 카드 — 방위+기간 일치 시 일반 결과 위에 (Phase 7) */
function FestivalBanner({ festival }: { festival: Festival }) {
  const mapHref = `https://map.kakao.com/link/search/${encodeURIComponent(`부산 ${festival.title}`)}`
  return (
    <a
      href={mapHref}
      target="_blank"
      rel="noreferrer"
      className="motion-card-enter result-festival-notice"
    >
      <div className="result-festival-kicker">현재 진행 중인 행사</div>
      <div className="result-festival-title">{festival.title}</div>
      <div className="result-festival-meta">
        {festival.district ? `${festival.district} · ` : ''}
        {shortDate(festival.startDate)}–{shortDate(festival.endDate)} · 지도에서 보기 ›
      </div>
    </a>
  )
}

function VisitFactsSection({ facts }: { facts: readonly PoiVisitFact[] }) {
  return (
    <section className="result-visit-section" aria-labelledby="result-visit-title">
      <h3 id="result-visit-title">방문 정보</h3>
      <div className="result-visit-facts">
        {facts.map((fact) => <InfoRow key={fact.key} label={fact.label} value={fact.value} />)}
      </div>
    </section>
  )
}

function VisitFactsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'result-visit-skeleton result-visit-skeleton--compact' : 'result-visit-skeleton'} aria-label="방문 정보 불러오는 중">
      {!compact && <div className="skeleton" style={{ width: 72, height: 18, borderRadius: 4 }} />}
      {[0, 1, 2].map((index) => (
        <div key={index} className="result-visit-skeleton-row">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  const displayValue = loading ? '불러오는 중' : normalizeInfoValue(value)
  return (
    <div className="result-info-row">
      <div className="result-info-label">{label}</div>
      <div className="result-info-value">{displayValue}</div>
    </div>
  )
}

/** TourAPI 자유 텍스트의 단순 HTML 표기를 모바일용 일반 텍스트로 정리한다. */
function normalizeInfoValue(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .trim()
}

function ResultSkeleton() {
  return (
    <div aria-label="불러오는 중">
      <div className="skeleton" style={{ height: 'clamp(190px, 30svh, 300px)', borderRadius: 24 }} />
      <div style={{ padding: '16px 2px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 28, width: '58%' }} />
        <div className="skeleton" style={{ height: 14, width: '76%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%' }} />
        <div className="skeleton" style={{ height: 18, width: 88, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 16, width: '100%' }} />
        <div className="skeleton" style={{ height: 16, width: '92%' }} />
        <div className="skeleton" style={{ height: 16, width: '74%' }} />
      </div>
    </div>
  )
}
