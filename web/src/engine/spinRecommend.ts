/**
 * 스핀 추천 배선 — canonical 앱(별이 화면)의 스핀을 실제 점수 엔진에 연결한다.
 * SPEC 4장: 점수 = 방향 일치도 × 접근 가능성(존-교량) × 운영 상태 × 분산 가중치.
 *
 * POI 우주는 큐레이션 정적 풀(mock/pois)이지만 각 POI는 실제 contentId·좌표에 바인딩돼 있고,
 * 방위는 **출발점 기준 방위각**으로, 이동시간은 **존-교량 모델**로, 티어 가중은 정적 tier로
 * 계산한다 — 즉 출발점·다이얼이 결과를 실제로 바꾼다(기존 목 추천은 둘 다 무시했다).
 * 좌표는 전부 단말 내에서만 소비하고 네트워크로 나가지 않는다 (절대 원칙 1).
 */
import { TIER_WEIGHT, type Tier as CurationTier } from './curation'
import { haversineMeters, type GeoPoint } from './geo'
import { recommend as scoreRecommend, type Dial, type EnginePoi } from './recommend'
import {
  DIRECTIONS,
  POI_POOL,
  type Departure,
  type DialId,
  type Poi,
  type Recommendation,
} from '../mock/pois'

/** 앱 다이얼 → 엔진 다이얼 (하루=day는 권역 내 무제한) — 코스 브리지도 공유 */
export const DIAL_MAP: Record<DialId, Dial> = { light: 'light', half: 'half', full: 'day' }

/** 정적 Poi.tier(1/2/3) → 큐레이션 티어 (curation.ts TIER_WEIGHT 재사용) */
const TIER_KEY: Record<Poi['tier'], CurationTier> = { 1: 'T1', 2: 'T2', 3: 'T3' }

/** contentId → 원본 Poi. 엔진 결과를 화면용 Poi로 되돌릴 때 코스 브리지도 공유한다. */
export const POI_BY_CONTENT_ID: ReadonlyMap<string, Poi> = new Map(
  POI_POOL.map((p) => [p.contentId, p]),
)

/** 엔진 입력 POI — 큐레이션 풀을 contentId·좌표만 남겨 변환 (단일 추천·코스 공용 우주) */
export const ENGINE_POIS: readonly EnginePoi[] = POI_POOL.map((p) => ({
  contentId: p.contentId,
  title: p.name,
  point: { lat: p.lat, lng: p.lon },
}))

/** 정적 풀 티어 기반 분산 가중치 — 단일 추천과 코스가 동일한 값을 쓰도록 공유한다. */
export function dispersionWeightOf(contentId: string): number {
  const poi = POI_BY_CONTENT_ID.get(contentId)
  return TIER_WEIGHT[poi ? TIER_KEY[poi.tier] : 'T2']
}

export function toGeo(d: Departure): GeoPoint {
  return { lat: d.lat, lng: d.lon }
}

export interface SpinRecommendInput {
  heading: number
  departure: Departure
  dial: DialId
  /** 직전 당첨 contentId — 다시 돌리기 시 즉시 반복 방지 */
  prevContentId?: string
  /** 테스트용 시드 주입 (기본 Math.random) */
  rng?: () => number
}

/**
 * 스핀 1회 → 화면용 Recommendation.
 * 사용자 다이얼 예산에서 후보가 0이면(시연 데드엔드 방지) 하루 나들이 범위로 한 번 더 넓히고 사유를 남긴다.
 */
export function recommendFromSpin(input: SpinRecommendInput): Recommendation {
  const rng = input.rng ?? Math.random
  const run = (dial: Dial) =>
    scoreRecommend({
      origin: toGeo(input.departure),
      heading: input.heading,
      dial,
      pois: ENGINE_POIS,
      rng,
      prevContentId: input.prevContentId,
      dispersionWeightOf,
    })

  let result = run(DIAL_MAP[input.dial])
  let dialWidened = false
  if (!result.picked && input.dial !== 'full') {
    result = run('day') // 이 시간 예산엔 없음 → 권역 전체로 최종 폴백
    dialWidened = true
  }

  const direction = DIRECTIONS.find((d) => d.id === result.sector) ?? DIRECTIONS[0]

  const ranked = result.picked ? [result.picked, ...result.alternates] : []
  const candidates = ranked
    .map((c) => {
      const base = POI_BY_CONTENT_ID.get(c.poi.contentId)
      if (!base) return null
      // 출발점 기준 보정 이동시간으로 walkMinutes를 덮어써 카드에 실제 거리를 반영
      return { ...base, walkMinutes: Math.max(1, Math.round(c.travel.minutes)) }
    })
    .filter((p): p is Poi => p !== null)

  // 이론상 도달 불가(21곳이 157.5° 밖에 전부 몰릴 수 없음)하지만 시연 데드엔드를 원천 차단:
  // 후보가 하나도 없으면 출발점에서 가장 가까운 곳으로 안내한다.
  if (candidates.length === 0) {
    const origin = toGeo(input.departure)
    const nearest = [...POI_POOL].sort(
      (a, b) =>
        haversineMeters(origin, { lat: a.lat, lng: a.lon }) -
        haversineMeters(origin, { lat: b.lat, lng: b.lon }),
    )[0]
    return {
      direction,
      candidates: [nearest],
      expandReason: '이 방향엔 마땅한 곳이 없어 가까운 곳으로 안내했어요',
    }
  }

  const expandReason = dialWidened
    ? '이 시간 안에는 없어서, 조금 먼 곳까지 넓혔어요'
    : result.expansionReason

  return { direction, candidates, expandReason }
}
